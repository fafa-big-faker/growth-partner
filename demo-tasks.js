// One-time task-design snapshot, 2026-09-29. No player records or source identifiers.
(function (root) {
  const tasks = [
    { id: 'demo-task-1', taskType: 'daily', title: '每日签到', description: '日积月累，助你前行', difficulty: 'C', rewardChopping: 10, rewardItems: [{ item_id: '40002', quantity: 1 }] },
    { id: 'demo-task-2', taskType: 'weekly', title: '给你哥打电话', description: '时长超过5分钟，除了聊自己，也要关注对方生活状况', difficulty: 'S', rewardChopping: 33, rewardItems: [{ item_id: '30201', quantity: 1 }] },
    { id: 'demo-task-3', taskType: 'weekly', title: '给你老爸打电话', description: '时长超过5分钟，除了聊自己，也要关注对方生活状况', difficulty: 'S', rewardChopping: 33, rewardItems: [{ item_id: '30001', quantity: 1 }] },
    { id: 'demo-task-4', taskType: 'weekly', title: '给你老妈打电话', description: '时长超过5分钟，除了聊自己，也要关注对方生活状况', difficulty: 'S', rewardChopping: 33, rewardItems: [{ item_id: '30101', quantity: 1 }] },
    { id: 'demo-task-5', taskType: 'theme', title: '组局全部舍友一起聚餐', description: '可以请舍友也可以AA，总之撺掇起这个局，顺利吃完才算完成哦', difficulty: 'S', rewardChopping: 100, themeName: '开学季·开工咯' },
    { id: 'demo-task-6', taskType: 'theme', title: '熟悉全部舍友信息', description: '姓名，来自哪个省，性格怎么样，可以打电话的时候和我说', difficulty: 'A', rewardChopping: 50, themeName: '开学季·开工咯' },
    { id: 'demo-task-7', taskType: 'theme', title: '在班级活动中主动发言介绍自己', description: '一般开学班导会带大家介绍自己，出来主动聊天', difficulty: 'B', rewardChopping: 30, themeName: '开学季·开工咯' },
    { id: 'demo-task-8', taskType: 'theme', title: '和班助熟络', description: '加上班助好友，主动聊天，不知道聊什么问AI，要聊得很熟络才算完成噢', difficulty: 'S', rewardChopping: 100, themeName: '开学季·开工咯' },
    { id: 'demo-task-9', taskType: 'theme', title: '学会和Agent打交道', description: '安装一个Agent为自己工作，介绍自己的情况，让它帮助你学习，进行一个小任务才算完成', difficulty: 'B', rewardChopping: 30, themeName: '开学季·开工咯' },
  ].map((task, index) => ({ rewardItems: [], themeName: null, themeExtraReward: [], sortOrder: index + 1, ...task }));
  root.DemoTaskTemplate = tasks;
  if (typeof module !== 'undefined' && module.exports) module.exports = tasks;
})(typeof globalThis !== 'undefined' ? globalThis : window);
