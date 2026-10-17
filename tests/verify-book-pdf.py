"""Check actual Chromium PDFs, beyond HTML or PDF magic-byte assertions."""
from pathlib import Path
import sys
from pypdf import PdfReader

folder = Path(sys.argv[1])
expected = {
    'flavors': ['山珍海味', '鲜肉小笼包', '溏心蛋拉面', '家常蛋炒饭', '周末能量早午餐', '散步时发现的小店'],
    'favorites': ['山珍海味', '鲜肉小笼包', '家常蛋炒饭', '窑烤玛格丽特'],
    'no-photo': ['山珍海味', '无照片的记忆', '<b>原文安全保留</b>'],
    'recipes': ['独家食谱', '家常蛋炒饭', '食材与用量', '熟米饭', '制作步骤', '完整步骤结束标记', '心得结束标记'],
    'feasts': ['欢聚一堂', '热气腾腾的早晨', '整桌饭局专属说明', '当餐记录结束标记', '和朋友的周末小聚'],
    'ui-recipes': ['独家食谱', '完整步骤结束标记', '心得结束标记'],
}
for stem, words in expected.items():
    reader = PdfReader(folder / (stem + '.pdf'))
    text = '\n'.join(page.extract_text() or '' for page in reader.pages)
    compact = ''.join(text.split())
    for word in words:
        assert ''.join(word.split()) in compact, (stem, 'missing text', word)
    assert len(reader.pages) >= 3, (stem, 'missing cover, contents or entry')
    assert all(abs(float(p.mediabox.width) - 595.28) < 2 for p in reader.pages), (stem, 'not A4')
    assert '笑食天下' in compact
    if stem == 'favorites':
        assert '缤纷蔬菜沙拉' not in compact and '周末能量早午餐' not in compact
    images = sum(len(page.images) for page in reader.pages)
    assert images > (1 if stem != 'no-photo' else 0), (stem, 'missing actual pictures')
    print(f'PASS PDF {stem}: {len(reader.pages)} A4 pages, {images} images, complete searchable Chinese text')
