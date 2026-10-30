"""Fetch matching album artwork from Apple's public catalogue; keep local copies."""
import concurrent.futures
import json
import html
from pathlib import Path
import re
import sys
import unicodedata
from urllib.parse import urlencode
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from shop.covers import cover_stem

COLLECTION_IDS = {
    'Nujabes': 1078914477,
    'idealism': 1430451268,
    'Green Day': 1160081985,
    'A Tribe Called Quest': 278911460,
}

def album_page_image(collection_id):
    url = f'https://music.apple.com/us/album/{collection_id}'
    with urlopen(url, timeout=30) as response:
        page = response.read().decode()
    tag = re.search(r'<meta[^>]+property="og:image"[^>]+>', page).group(0)
    social = html.unescape(re.search(r'content="([^"]+)"', tag).group(1))
    base = social.rsplit('/', 1)[0] + '/'
    # Use the actual square artwork listed on the page, not its social preview.
    candidates = re.findall(r'https://is[0-9][^" ]+600x600[^" ]+', page)
    return next(html.unescape(image) for image in candidates if image.startswith(base)), url

def normalize(value):
    return re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode().lower())

def fetch(album):
    artist, title, genre, year = album
    dest = ROOT / 'static/covers/albums' / (cover_stem({'artist': artist, 'title': title, 'id': 0}) + '.jpg')
    if dest.is_file() or dest.with_suffix('.png').is_file():
        return {'artist': artist, 'title': title, 'status': 'existing'}
    url = 'https://itunes.apple.com/search?' + urlencode({'term': artist+' '+title, 'entity': 'album', 'limit': 15, 'country': 'US'})
    if artist in COLLECTION_IDS:
        url = 'https://itunes.apple.com/lookup?' + urlencode({'id': COLLECTION_IDS[artist], 'country': 'US'})
    try:
        try:
            with urlopen(url, timeout=30) as response:
                results = json.load(response)['results']
        except Exception:
            if artist not in COLLECTION_IDS:
                raise
            image_url, source = album_page_image(COLLECTION_IDS[artist])
            results = [{'artistName': artist, 'collectionName': title, 'artworkUrl100': image_url, 'collectionViewUrl': source}]
        match = next((r for r in results if normalize(r['artistName']) == normalize(artist) and normalize(r['collectionName']).startswith(normalize(title))), None)
        if not match:
            return {'artist': artist, 'title': title, 'status': 'not_found'}
        image_url = match['artworkUrl100'].replace('100x100bb', '600x600bb')
        with urlopen(image_url, timeout=30) as response:
            content = response.read()
        from PIL import Image
        from io import BytesIO
        with Image.open(BytesIO(content)) as image:
            image.convert('RGB').save(dest, 'JPEG', quality=90)
        return {'artist': artist, 'title': title, 'status': 'downloaded', 'source': match['collectionViewUrl'], 'matched_title': match['collectionName']}
    except Exception as error:
        return {'artist': artist, 'title': title, 'status': str(error)}

if __name__ == '__main__':
    albums = json.loads((ROOT / 'shop/catalog_expansion.json').read_text(encoding='utf-8'))
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(fetch, albums))
    source_file = ROOT / 'static/covers/albums/sources.json'
    previous = {(r['artist'], r['title']): r for r in json.loads(source_file.read_text(encoding='utf-8'))} if source_file.is_file() else {}
    results = [previous.get((r['artist'], r['title']), r) if r['status'] == 'existing' else r for r in results]
    (ROOT / 'static/covers/albums/sources.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
    for result in results:
        print((result['artist'] + ' / ' + result['title'] + ': ' + result['status']).encode('ascii', 'backslashreplace').decode())
