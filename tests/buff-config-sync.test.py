import ast
from pathlib import Path
import unittest


SOURCE = Path(__file__).resolve().parents[1] / "sync-config.py"
TREE = ast.parse(SOURCE.read_text(encoding="utf-8"), filename=str(SOURCE))
FUNCTIONS = {"to_int", "to_str", "header_indexes", "row_value", "parse_buff_table"}
NAMESPACE = {}
exec(compile(ast.Module(
    body=[node for node in TREE.body if isinstance(node, ast.FunctionDef) and node.name in FUNCTIONS],
    type_ignores=[],
), str(SOURCE), "exec"), NAMESPACE)
parse_buff_table = NAMESPACE["parse_buff_table"]

HEADERS = [
    "id", "buff_id", "buff_quality", "buff_description", "params_type_desc",
    "effect_desc", "value1_range", "value2_range", "value3_range", "weight", "type",
]


def sheet_row(buff_type="1", **overrides):
    values = {
        "id": "51", "buff_id": "91", "buff_quality": "3",
        "buff_description": "effect {value1}", "params_type_desc": "params",
        "effect_desc": "note", "value1_range": "1", "value2_range": "10.01,15",
        "value3_range": "2,3", "weight": "50", "type": buff_type,
    }
    values.update(overrides)
    return values


def sheet(values, headers=HEADERS):
    return [list(headers), ["label"] * len(headers)] + [
        [row.get(field, "") for field in headers] for row in values
    ]


class BuffConfigSyncTests(unittest.TestCase):
    def test_reads_type_by_header_after_reordering(self):
        headers = ["type", "weight"] + list(reversed(HEADERS[:-2]))
        result = parse_buff_table(sheet([sheet_row()], headers))[0]
        self.assertEqual(result, {
            "id": 51, "buffId": 91, "type": 1, "buffQuality": 3,
            "description": "effect {value1}", "paramsTypeDesc": "params",
            "effectDesc": "note", "value1Range": "1", "value2Range": "10.01,15",
            "value3Range": "2,3", "weight": 50,
        })

    def test_effect_type_is_independent_of_group_id(self):
        result = parse_buff_table(sheet([
            sheet_row("1", buff_id="999"),
            sheet_row("2", id="52", buff_id="1", value3_range=""),
        ]))
        self.assertEqual([(row["buffId"], row["type"]) for row in result], [(999, 1), (1, 2)])
        self.assertEqual(result[1]["value3Range"], "")

    def test_requires_english_type_header(self):
        for headers in [HEADERS[:-1], HEADERS[:-1] + ["buff类型"]]:
            with self.subTest(headers=headers), self.assertRaisesRegex(RuntimeError, "type"):
                parse_buff_table(sheet([sheet_row()], headers))

    def test_rejects_blank_or_unsupported_types_without_truncating(self):
        for value in ["", None, "0", "3", "1.5", "2.1", "bad", "NaN", "Infinity", True]:
            with self.subTest(value=value), self.assertRaisesRegex(RuntimeError, "第3行 type"):
                parse_buff_table(sheet([sheet_row(value)]))

    def test_accepts_numeric_cells_but_emits_integer_types(self):
        for value in [1, 2, 1.0, 2.0, " 1 ", "2.0"]:
            with self.subTest(value=value):
                result = parse_buff_table(sheet([sheet_row(value)]))[0]["type"]
                self.assertIs(type(result), int)
                self.assertEqual(result, int(float(value)))

    def test_blank_rows_are_ignored_and_error_has_actual_sheet_row(self):
        rows = sheet([sheet_row(), {"id": ""}, sheet_row("3", id="52")])
        with self.assertRaisesRegex(RuntimeError, "第5行 type"):
            parse_buff_table(rows)
        self.assertEqual(len(parse_buff_table(rows[:4])), 1)


if __name__ == "__main__":
    unittest.main()
