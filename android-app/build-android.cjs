#!/usr/bin/env node
'use strict';

// Build the framework-only Android shell with an installed SDK, without downloading Gradle dependencies.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const project = __dirname;
const repository = path.dirname(project);
const resources = path.dirname(repository);
const appSource = path.join(project, 'app', 'src', 'main');
let toolWorkingDirectory = project;
const unity = 'D:/untiy3d/2022.3.62f2c1/Editor/Data/PlaybackEngines/AndroidPlayer';
const sdk = path.resolve(process.env.XIANLAI_ANDROID_SDK || process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME || path.join(unity, 'SDK'));
const jdk = path.resolve(process.env.XIANLAI_JAVA_HOME || process.env.JAVA_HOME || path.join(unity, 'OpenJDK'));
const output = path.resolve(process.env.XIANLAI_APK_OUTPUT || path.join(resources, '安卓安装包'));
const signingDirectory = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Xianlai', 'signing');
const backupDirectory = path.join(resources, '仙来签名备份（勿公开）');
const signingFile = path.join(signingDirectory, 'signing.json');
const initSigning = process.argv.includes('--init-signing');
const executable = name => path.join(jdk, 'bin', `${name}${process.platform === 'win32' ? '.exe' : ''}`);

function exists(file) { return fs.existsSync(file); }
function assert(condition, message) { if (!condition) throw new Error(message); }
function outsideRepository(directory) {
  const relative = path.relative(repository, directory);
  assert(relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative), 'Private signing and APK output must remain outside the repository.');
}
function run(command, args, options = {}) {
  try {
    return execFileSync(command, args, {
      cwd: toolWorkingDirectory, encoding: 'utf8', timeout: 60000, windowsHide: true,
      maxBuffer: 8 * 1024 * 1024, ...options,
    });
  } catch (error) {
    // Passwords are passed only through a dedicated child environment; never echo child arguments or config.
    const detail = `${error.stdout || ''}\n${error.stderr || ''}`.trim();
    throw new Error(`${path.basename(command)} failed${error.signal ? ` (${error.signal})` : ''}.\n${detail}`);
  }
}
function restrictDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
  if (process.platform === 'win32') {
    const identity = `${process.env.USERDOMAIN}\\${process.env.USERNAME}`;
    run('icacls.exe', [directory, '/inheritance:r', '/grant:r', `${identity}:(OI)(CI)F`, 'SYSTEM:(OI)(CI)F']);
  } else {
    fs.chmodSync(directory, 0o700);
  }
}
function filesUnder(directory, suffix) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(file, suffix) : (file.endsWith(suffix) ? [file] : []);
  });
}
function stageDirectory(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const sourceFile = path.join(from, entry.name);
    const targetFile = path.join(to, entry.name);
    if (entry.isDirectory()) stageDirectory(sourceFile, targetFile);
    else fs.copyFileSync(sourceFile, targetFile);
  }
}
function hash(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function newestDirectory(directory, predicate) {
  return fs.readdirSync(directory).filter(predicate).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0];
}

function mimeFor(file) {
  const extension = path.extname(file).toLowerCase();
  return ({ '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' })[extension];
}

function stageBundledAssets(assetDirectory) {
  const boot = require('../scripts/build_boot_assets.cjs');
  const manifest = boot.generate(repository);
  const copied = new Map();
  const lines = [];
  for (const asset of manifest.assets) {
    const resolved = boot.fileForUrl(asset.url, repository);
    const relative = asset.url.split('?')[0];
    const packaged = `xianlai/${relative}`;
    const previous = copied.get(packaged);
    if (previous) assert(previous === asset.sha256, `Bundled asset path collision: ${relative}`);
    else {
      const destination = path.join(assetDirectory, ...packaged.split('/'));
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(resolved.file, destination);
      copied.set(packaged, asset.sha256);
    }
    const mime = mimeFor(resolved.file);
    assert(mime, `Unsupported bundled asset type: ${relative}`);
    lines.push([asset.url, packaged, mime, asset.bytes, asset.sha256].join('\t'));
  }
  const manifestFile = path.join(assetDirectory, 'xianlai', 'bundled-assets.tsv');
  fs.mkdirSync(path.dirname(manifestFile), { recursive: true });
  fs.writeFileSync(manifestFile, lines.join('\n') + '\n');
  return { entries: lines.length, payloads: copied.size, bytes: manifest.assets.reduce((sum, asset) => sum + asset.bytes, 0), manifestFile };
}

function main() {
  console.log('Preparing installed Android toolchain...');
  outsideRepository(output);
  outsideRepository(signingDirectory);
  outsideRepository(backupDirectory);
  assert(exists(executable('javac')), 'Java compiler not found. Set XIANLAI_JAVA_HOME to an installed JDK.');
  assert(exists(path.join(sdk, 'build-tools')), 'Android SDK not found. Set XIANLAI_ANDROID_SDK.');
  const buildVersion = newestDirectory(path.join(sdk, 'build-tools'), value => /^\d+\.\d+\.\d+$/.test(value));
  const buildTools = path.join(sdk, 'build-tools', buildVersion || '');
  const androidJar = path.join(sdk, 'platforms', 'android-35', 'android.jar');
  for (const file of [androidJar, path.join(buildTools, 'aapt2.exe'), path.join(buildTools, 'zipalign.exe'),
    path.join(buildTools, 'lib', 'd8.jar'), path.join(buildTools, 'lib', 'apksigner.jar')]) {
    assert(exists(file), `Required Android tool not found: ${file}`);
  }
  const manifest = fs.readFileSync(path.join(appSource, 'AndroidManifest.xml'), 'utf8');
  const versionName = manifest.match(/android:versionName="([^"]+)"/)[1];
  const versionCode = manifest.match(/android:versionCode="(\d+)"/)[1];
  const gradle = fs.readFileSync(path.join(project, 'app', 'build.gradle'), 'utf8');
  assert(gradle.includes(`versionName '${versionName}'`) && gradle.includes(`versionCode ${versionCode}`), 'Manifest and Gradle version values must match.');
  assert(exists(path.join(appSource, 'res', 'drawable-nodpi', 'launcher_foreground.png')), 'Export the approved icon first: python android-app/export-icon.py');

  // The Windows SDK's native aapt2 cannot open this repository's Chinese directory name.
  // Stage generated build inputs in the ASCII system temp path; original sources stay untouched.
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'xianlai-android-'));
  assert(/^[\x00-\x7F]+$/.test(work), 'Android native tools require an ASCII temp path. Set TEMP and TMP to a dedicated ASCII directory.');
  toolWorkingDirectory = work;
  const source = path.join(work, 'source');
  console.log('Staging sources for Windows Android tools...');
  stageDirectory(appSource, source);
  const bundled = stageBundledAssets(path.join(source, 'assets'));
  console.log(`Bundled ${bundled.payloads} runtime files (${bundled.bytes} bytes) for exact local reuse.`);
  const classes = path.join(work, 'classes');
  const testClasses = path.join(work, 'tests');
  const generated = path.join(work, 'generated');
  const dex = path.join(work, 'dex');
  [classes, testClasses, generated, dex, output].forEach(directory => fs.mkdirSync(directory, { recursive: true }));

  console.log('Checking trusted navigation boundaries...');
  const policy = path.join(source, 'java', 'cn', 'xianlai', 'game', 'NavigationPolicy.java');
  run(executable('javac'), ['-encoding', 'UTF-8', '-source', '8', '-target', '8', '-d', testClasses, policy, path.join(project, 'tests', 'NavigationPolicyTest.java')]);
  process.stdout.write(run(executable('java'), ['-cp', testClasses, 'cn.xianlai.game.NavigationPolicyTest']));

  console.log('Checking deterministic PCM decoding and mixing...');
  const pcmWave = path.join(source, 'java', 'cn', 'xianlai', 'game', 'PcmWave.java');
  const pcmMixer = path.join(source, 'java', 'cn', 'xianlai', 'game', 'PcmMixer.java');
  run(executable('javac'), ['-encoding', 'UTF-8', '-source', '8', '-target', '8', '-d', testClasses,
    pcmWave, pcmMixer, path.join(project, 'tests', 'PcmAudioTest.java')]);
  process.stdout.write(run(executable('java'), ['-cp', testClasses, 'cn.xianlai.game.PcmAudioTest']));

  console.log('Compiling Android resources and Java...');
  const compiledResources = path.join(work, 'resources.zip');
  const resourcesApk = path.join(work, 'resources.apk');
  run(path.join(buildTools, 'aapt2.exe'), ['compile', '--dir', path.join(source, 'res'), '-o', compiledResources]);
  run(path.join(buildTools, 'aapt2.exe'), ['link', '-o', resourcesApk, '-I', androidJar,
    '--manifest', path.join(source, 'AndroidManifest.xml'), '--java', generated, '--auto-add-overlay', compiledResources]);
  run(executable('javac'), ['-encoding', 'UTF-8', '-source', '8', '-target', '8', '-classpath', androidJar,
    '-d', classes, ...filesUnder(path.join(source, 'java'), '.java'), ...filesUnder(generated, '.java')]);
  const classesJar = path.join(work, 'classes.jar');
  run(executable('jar'), ['cf', classesJar, '-C', classes, '.']);
  run(executable('java'), ['-cp', path.join(buildTools, 'lib', 'd8.jar'), 'com.android.tools.r8.D8',
    '--release', '--min-api', '26', '--lib', androidJar, '--output', dex, classesJar]);
  const unsigned = path.join(work, 'unsigned.apk');
  fs.copyFileSync(resourcesApk, unsigned);
  // Java's jar writer uses portable ZIP entry separators on Windows. Store the
  // already-compressed media verbatim so SoundPool can open WAV file descriptors.
  run(executable('jar'), ['u0f', unsigned, '-C', path.join(source, 'assets'), '.']);
  for (const dexFile of filesUnder(dex, '.dex')) {
    run(executable('jar'), ['uf', unsigned, '-C', dex, path.basename(dexFile)]);
  }
  const aligned = path.join(work, 'aligned.apk');
  run(path.join(buildTools, 'zipalign.exe'), ['-f', '-p', '4', unsigned, aligned]);

  if (!exists(signingFile)) {
    assert(initSigning, 'No release signing config found. First build: --init-signing. If an APK was previously distributed, restore its original signing backup instead.');
    assert(!exists(backupDirectory), 'A signing backup already exists. Restore it; never replace an existing application signing identity.');
    restrictDirectory(signingDirectory);
    restrictDirectory(backupDirectory);
    const keyStore = path.join(signingDirectory, 'xianlai-release.p12');
    assert(!exists(keyStore), 'An existing keystore was found. Restore its original signing.json; do not create a replacement.');
    const config = { keyStore, alias: 'xianlai', password: crypto.randomBytes(36).toString('base64url') };
    console.log('Creating dedicated release signing identity outside the repository...');
    run(executable('keytool'), ['-genkeypair', '-keystore', keyStore, '-storetype', 'PKCS12',
      '-alias', config.alias, '-keyalg', 'RSA', '-keysize', '3072', '-validity', '36500',
      '-dname', 'CN=Xianlai Android, O=Xianlai', '-storepass:env', 'XIANLAI_SIGNING_PASSWORD',
      '-keypass:env', 'XIANLAI_SIGNING_PASSWORD', '-noprompt'], {
      env: { ...process.env, XIANLAI_SIGNING_PASSWORD: config.password },
    });
    fs.writeFileSync(signingFile, JSON.stringify(config, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    fs.copyFileSync(keyStore, path.join(backupDirectory, path.basename(keyStore)), fs.constants.COPYFILE_EXCL);
    fs.copyFileSync(signingFile, path.join(backupDirectory, 'signing.json'), fs.constants.COPYFILE_EXCL);
  }
  const signing = JSON.parse(fs.readFileSync(signingFile, 'utf8'));
  outsideRepository(path.dirname(signing.keyStore));
  assert(exists(signing.keyStore), 'Original release keystore is missing. Restore the signing backup before building.');
  assert(signing.alias && signing.password, 'Release signing configuration is incomplete.');
  const apk = path.join(work, `xianlai-${versionName}.apk`);
  const signer = path.join(buildTools, 'lib', 'apksigner.jar');
  console.log('Signing and verifying the installable APK...');
  run(executable('java'), ['-jar', signer, 'sign', '--ks', signing.keyStore, '--ks-key-alias', signing.alias,
    '--ks-pass', 'env:XIANLAI_SIGNING_PASSWORD', '--key-pass', 'env:XIANLAI_SIGNING_PASSWORD',
    '--v1-signing-enabled', 'false', '--v2-signing-enabled', 'true', '--v3-signing-enabled', 'true',
    '--v4-signing-enabled', 'false', '--out', apk, aligned], {
    env: { ...process.env, XIANLAI_SIGNING_PASSWORD: signing.password },
  });
  const verification = run(executable('java'), ['-jar', signer, 'verify', '--verbose', '--print-certs', apk]);
  assert(verification.includes('Verified using v2 scheme (APK Signature Scheme v2): true'), 'APK v2 signature verification failed.');
  assert(verification.includes('Verified using v3 scheme (APK Signature Scheme v3): true'), 'APK v3 signature verification failed.');
  run(path.join(buildTools, 'zipalign.exe'), ['-c', '-p', '4', apk]);
  const badging = run(path.join(buildTools, 'aapt.exe'), ['dump', 'badging', apk]);
  assert(badging.includes("name='cn.xianlai.game'"), 'APK application ID is incorrect.');
  assert(!badging.includes('application-debuggable'), 'A debuggable APK must not be distributed.');
  const permissions = badging.split(/\r?\n/).filter(line => line.startsWith('uses-permission:'));
  assert(permissions.length === 1 && permissions[0].includes('android.permission.INTERNET'), 'Unexpected APK permissions.');
  const archive = run(path.join(buildTools, 'aapt.exe'), ['list', '-v', apk]);
  assert(archive.includes('xianlai/assets/runtime/audio/ui-tap.wav'), 'Native UI sound is missing from the APK.');
  assert(archive.includes('xianlai/bundled-assets.tsv'), 'Bundled asset manifest is missing from the APK.');
  assert(!archive.includes('xianlai\\assets'), 'APK asset entries must use portable forward slashes.');
  const uiTapLine = archive.split(/\r?\n/).find(line => line.includes('xianlai/assets/runtime/audio/ui-tap.wav')) || '';
  assert(uiTapLine.includes('Stored'), 'Native SoundPool cues must remain uncompressed in the APK.');
  const deliveredApk = path.join(output, path.basename(apk));
  fs.copyFileSync(apk, deliveredApk);
  const record = {
    app: '仙来', applicationId: 'cn.xianlai.game', versionName, versionCode: Number(versionCode),
    builtAt: new Date().toISOString(), apk: deliveredApk, bytes: fs.statSync(apk).size, sha256: hash(apk),
    minAndroid: '8.0 (API 26)', targetSdk: 35, buildTools: buildVersion,
    gameUrl: 'https://fafa-big-faker.github.io/growth-partner/',
    signerSha256: verification.match(/certificate SHA-256 digest: ([a-f0-9]+)/i)?.[1],
    signingDirectory, backupDirectory,
    checks: ['27 navigation boundary assertions', 'exact bundled runtime assets', 'uncompressed native audio',
      'Java compilation', 'DEX generation', 'APK v2/v3 signature verification', 'ZIP alignment', 'application ID and Internet-only permission'],
    deviceTest: 'Not performed: no Android device is connected and no emulator system image is installed.',
  };
  fs.writeFileSync(path.join(output, '构建记录.json'), JSON.stringify(record, null, 2) + '\n');
  fs.writeFileSync(path.join(output, `xianlai-${versionName}.sha256`), `${record.sha256}  ${path.basename(apk)}\n`);
  fs.writeFileSync(path.join(output, '安装说明.txt'), [
    '仙来 Android 轻量版', '',
    `安装文件：${path.basename(apk)}`, '需要 Android 8.0 或以上及网络连接。',
    '把 APK 发送到自己的安卓手机，打开文件并按系统提示允许当前来源安装。',
    '安装后使用原来的仙来账号登录。应用和浏览器的登录状态独立，玩家进度仍由云端保存。',
    '后续网页内容更新：关闭后重新打开应用即可取得最新入口。无需反复安装 APK。',
    '首次连接较慢或断网时，可以点“重新连接”；若提示 WebView 不可用，请更新系统 WebView 或 Chrome。',
    '此包已通过编译、导航边界、签名、包名及权限检查；当前电脑未连接安卓设备，尚未真机验收。',
    '', '开发者请妥善备份仓库外的专用签名目录；签名材料不要发给玩家。',
  ].join('\r\n') + '\r\n');
  console.log(`APK ready: ${deliveredApk}`);
  console.log(`Size: ${record.bytes} bytes; SHA256: ${record.sha256}`);
  console.log('Release signatures v2/v3 and package metadata verified. No device runtime test was performed.');
}

module.exports = { main, stageBundledAssets, mimeFor };
if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
