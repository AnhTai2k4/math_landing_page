"""Đợt 24: lịch giả, cùng canonical JSON với web, không mạng."""
import datetime as dt
import json
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parents[1]
REPO = HERE.parents[1]
sys.path.insert(0, str(HERE))
import worker as w


class ClassRulesTests(unittest.TestCase):
    def opens(self, label, date):
        return w.p.class_opens_at(dict(class_name=label, lesson_date=date))[label]

    def test_every_senior_class_and_canonical_sessions(self):
        config = json.loads((REPO / '.qa-temp/dot-24/config.vps.json').read_text(encoding='utf-8'))
        rules = json.loads((REPO / 'server/btvn/class-rules.json').read_text(encoding='utf-8'))['classes']
        self.assertEqual(len(config['classes']), 12)
        for label, scope in config['classes'].items():
            self.assertTrue(scope['enabled'])
            self.assertEqual(scope['weekdays'], sorted(s['weekday'] - 1 for s in rules[label]['sessions']))
            for weekday in scope['weekdays']:
                date = dt.date(2026, 10, 19) + dt.timedelta(days=weekday)
                value = self.opens(label, date.isoformat())
                self.assertTrue(value.endswith('+07:00'))
                self.assertLessEqual(value[:10], date.isoformat())

    def test_paired_openings_across_month_and_year(self):
        self.assertEqual(self.opens('2K9 8+', '2026-11-03'), '2026-11-02T19:30:00+07:00')
        self.assertEqual(self.opens('2K9 8+', '2027-01-02'), '2027-01-01T19:30:00+07:00')
        self.assertEqual(self.opens('2K9 8+', '2026-10-22'), '2026-10-21T19:30:00+07:00')
        self.assertEqual(self.opens('2K9 9+', '2026-10-23'), '2026-10-23T19:30:00+07:00')
        self.assertEqual(self.opens('2K10 9+', '2026-11-01'), '2026-10-30T21:30:00+07:00')
        self.assertEqual(self.opens('2K10 9+', '2026-10-30'), '2026-10-30T21:30:00+07:00')
        self.assertEqual(self.opens('2K10 9+', '2026-10-27'), '2026-10-27T21:30:00+07:00')

    def test_worker_material_preserves_per_class_rules(self):
        source = dict(class_name='2K9 9+', lesson_date='2026-10-19', lesson_key='fake',
                      title='Bài giả', video='', document='', handout='', homework='',
                      class_dates={'2K9 9+': '2026-10-19', '2K9 8+': '2026-10-20'})
        material = w.material_base_wrapper(source)
        self.assertEqual(material['classDates'], source['class_dates'])
        self.assertEqual(material['classOpensAt'], {label: '2026-10-19T19:30:00+07:00' for label in source['class_dates']})

    def test_known_class_off_schedule_falls_back_and_missing_rules_blocks(self):
        self.assertEqual(self.opens('2K10 8+', '2026-10-20'), '2026-10-20T21:30:00+07:00')
        with patch.dict(os.environ, {'BTVN_CLASS_RULES': str(HERE / 'not-present.json')}):
            with self.assertRaisesRegex(w.p.GateError, 'class-rules'):
                self.opens('2K9 9+', '2026-10-19')

    def test_proposal_aliases_periods_and_allowlist(self):
        config = json.loads((REPO / '.qa-temp/dot-24/config.vps.json').read_text(encoding='utf-8'))
        example = json.loads((HERE / 'config.example.json').read_text(encoding='utf-8'))
        # Proposal đợt 24 giữ nguyên lịch sử; đợt 25 thêm host oEmbed vào mẫu.
        self.assertEqual(config['allowed_hosts'], [host for host in example['allowed_hosts'] if host!='www.youtube.com'])
        self.assertIn('www.youtube.com',example['allowed_hosts'])
        self.assertEqual(config.get('attendance_map'), example.get('attendance_map'))
        self.assertEqual(config['extractor']['model'], 'gpt-5.5')
        self.assertEqual(config['reviewer']['model'], 'claude-sonnet-5-5')
        self.assertEqual(config['periods'][0]['start'], '2026-09-01')
        self.assertEqual(config['periods'][-1]['end'], '2027-06-15')
        for a, b in zip(config['periods'], config['periods'][1:]):
            self.assertEqual(dt.date.fromisoformat(a['end']) + dt.timedelta(days=1), dt.date.fromisoformat(b['start']))
        aliases = {tab['name']: tab.get('class_aliases', {}) for sheet in config['sheets'] for tab in sheet['tabs']}
        self.assertEqual(aliases['HSA']['HSA'], '2K9 HSA (CN)')
        self.assertEqual(aliases['HSA .2']['HSA .2'], '2K9 HSA (THỨ 5)')
        self.assertEqual(aliases['HSA .2']['HSA'], '2K9 HSA (THỨ 5)')


if __name__ == '__main__':
    unittest.main()
