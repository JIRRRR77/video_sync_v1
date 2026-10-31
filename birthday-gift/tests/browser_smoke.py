"""Functional checks using Playwright and the cloud image's Chromium.

Run with the site server on port 4173. Test artifacts are ignored by Git.
Default playback exercises the configured song. Temporary image/audio fixtures
exercise the editor and export pipeline; they are not recipient assets.
"""
import json
import math
import os
from pathlib import Path
import struct
import tempfile
import wave

from PIL import Image, ImageChops, ImageDraw
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
RESULTS = ROOT / "test-results"
RESULTS.mkdir(exist_ok=True)
BASE = os.environ.get("GIFT_TEST_URL", "http://127.0.0.1:4173")
checks = []


def check(name, condition):
    assert condition, name
    checks.append(name)


def settle(page):
    page.evaluate("async () => { await Promise.all(document.getAnimations().filter(a => a.effect.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))); }")


def check_complete_voucher(path):
    with Image.open(path) as original:
        image = original.convert("RGB")
        width, height = image.size
        check("saved voucher is a high-resolution landscape ticket", width >= 2000 and 2.4 < width / height < 3)
        # The right-hand stub must contain actual alternating barcode stripes.
        # This checks the downloaded pixels, not the presence of export code.
        transitions = []
        for y in range(int(height * .55), int(height * .76)):
            row = [image.getpixel((x, y))[0] > 75 for x in range(int(width * .86), int(width * .97))]
            transitions.append(sum(a != b for a, b in zip(row, row[1:])))
        check("download includes the right-hand barcode stub", max(transitions) >= 20)
        cutouts = []
        for y in [int(height * .055), int(height * .945)]:
            cutouts.append(sum(image.getpixel((x, y))[0] > 220 for x in range(int(width * .81), int(width * .87))))
        check("download preserves both perforation cutouts", all(count > 12 for count in cutouts))


with tempfile.TemporaryDirectory(prefix="gift-test-") as temporary, sync_playwright() as p:
    temp = Path(temporary)
    for index in range(2):
        image = Image.new("RGB", (600, 800), (90 + index * 40,) * 3)
        draw = ImageDraw.Draw(image)
        draw.ellipse((130, 190, 470, 530), fill=(210, 210, 210))
        image.save(temp / f"fixture-{index}.png")
    with wave.open(str(temp / "fixture.wav"), "wb") as audio:
        audio.setparams((1, 2, 22050, 0, "NONE", "not compressed"))
        audio.writeframes(b"".join(struct.pack("<h", int(700 * math.sin(2 * math.pi * 220 * n / 22050))) for n in range(22050 * 3)))

    browser = p.chromium.launch(
        executable_path="/usr/bin/chromium", headless=True,
        args=["--no-sandbox", "--disable-dev-shm-usage"],
    )
    context = browser.new_context(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(BASE)
    expect(page.locator('html[data-ready="true"]')).to_have_count(1)
    expect(page.locator("#letter")).to_be_hidden()
    expect(page.locator("#editor-launch")).to_be_hidden()
    settle(page)
    page.screenshot(path=RESULTS / "desktop-envelope.png", full_page=True)
    check("recipient view hides editing and absent-photo placeholders", page.locator("#memories").is_hidden())
    has_music = page.locator("#background-music").evaluate("a => Boolean(a.getAttribute('src'))")
    check("music waits for a user gesture", page.locator("#background-music").evaluate("a => a.paused && a.currentTime === 0"))
    if not has_music:
        page.locator("#music-toggle").click()
        expect(page.locator("#music-panel")).to_be_visible()
        check("missing audio provides a real listening link, without fake playback", "music.youtube.com" in page.locator("#listen-link").get_attribute("href"))
        page.keyboard.press("Escape")
    page.locator("#open-envelope").focus()
    page.keyboard.press("Enter")
    expect(page.locator("#letter")).to_be_visible(timeout=6000)
    expect(page.locator("#invitation")).to_be_hidden()
    check("keyboard opens animated envelope and reveals configured voucher", page.locator("#voucher-amount").inner_text() == "3,000")
    if has_music:
        page.wait_for_function("() => { const a = document.querySelector('#background-music'); return !a.paused && a.currentTime > 0 && Number.isFinite(a.duration); }")
        duration = page.locator("#background-music").evaluate("a => a.duration")
        check("provided song plays in full after opening the envelope", 218 < duration < 219)
        page.locator("#background-music").evaluate("a => { a.currentTime = a.duration - 0.25; }")
        page.wait_for_function("() => { const a = document.querySelector('#background-music'); return a.loop && !a.paused && a.currentTime < 2; }", timeout=10000)
        check("background song loops at its actual end", page.locator("#background-music").evaluate("a => a.loop && !a.paused && a.currentTime < 2"))
        page.locator("#music-toggle").click()
        check("provided song pauses from its music control", page.locator("#background-music").evaluate("a => a.paused"))
        page.locator("#music-toggle").click()
        page.wait_for_function("() => !document.querySelector('#background-music').paused")
        check("provided song resumes from its music control", page.locator("#background-music").evaluate("a => !a.paused"))
        if page.locator("#gift-config").inner_text().strip() != "null":
            check("production HTML embeds the provided MP3", page.locator("#background-music").evaluate("a => a.getAttribute('src').startsWith('data:audio/mpeg;base64,')"))
    settle(page)
    page.screenshot(path=RESULTS / "desktop-letter.png", full_page=True)
    page.locator("#accept-gift").click()
    expect(page.locator("#accept-gift")).to_have_attribute("aria-pressed", "true")
    check("gift acceptance is visible and announced", "归你啦" in page.locator("#status").inner_text())
    first_confetti = page.locator("#celebration i").first.element_handle()
    expect(page.locator("#status")).to_have_class("toast", timeout=6000)
    page.locator("#accept-gift").click()
    expect(page.locator("#status")).to_have_class("toast is-visible")
    check("accepted gift responds again after its first confirmation expires", "已经替你收好" in page.locator("#status").inner_text())
    check("repeat acceptance restarts the celebration", first_confetti.evaluate("el => !el.isConnected") and page.locator("#celebration i").count() > 0)
    with page.expect_download() as download:
        page.locator("#save-voucher").click()
    voucher_path = RESULTS / "voucher.png"
    download.value.save_as(voucher_path)
    check_complete_voucher(voucher_path)
    page.locator("#close-letter").click()
    expect(page.locator("#invitation")).to_be_visible()
    check("envelope closes and can be reopened", page.locator("#open-envelope").is_enabled())

    # Clean recipient screenshots contain no generated fixtures or test strings.
    mobile_preview = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    preview = mobile_preview.new_page()
    preview.goto(BASE)
    expect(preview.locator('html[data-ready="true"]')).to_have_count(1)
    settle(preview)
    preview.screenshot(path=RESULTS / "mobile-recipient-envelope.png", full_page=True)
    preview.locator("#open-envelope").click()
    expect(preview.locator("#letter")).to_be_visible(timeout=6000)
    if has_music:
        preview.wait_for_function("() => { const a = document.querySelector('#background-music'); return !a.paused && a.currentTime > 0 && a.duration > 218 && a.duration < 219; }")
        check("provided song also starts on a phone's opening tap", preview.locator("#background-music").evaluate("a => !a.paused"))
    settle(preview)
    preview.screenshot(path=RESULTS / "mobile-recipient-letter.png", full_page=True)
    with preview.expect_download() as mobile_download:
        preview.locator("#save-voucher").click()
    mobile_voucher_path = RESULTS / "voucher-mobile.png"
    mobile_download.value.save_as(mobile_voucher_path)
    with Image.open(voucher_path) as desktop_voucher, Image.open(mobile_voucher_path) as mobile_voucher:
        check("phone downloads the same complete ticket as desktop", desktop_voucher.size == mobile_voucher.size and ImageChops.difference(desktop_voucher.convert("RGB"), mobile_voucher.convert("RGB")).getbbox() is None)
    mobile_preview.close()

    page.goto(BASE + "/?edit")
    expect(page.locator("#editor-launch")).to_be_visible()
    page.locator("#editor-launch").click()
    if has_music:
        page.locator("#remove-audio").click()
        page.locator("#apply-editor").click()
        expect(page.locator("#editor-dialog")).not_to_be_visible()
        page.locator("#music-toggle").click()
        expect(page.locator("#music-panel")).to_be_visible()
        check("removing the song restores the music-platform fallback", "music.youtube.com" in page.locator("#listen-link").get_attribute("href"))
        page.keyboard.press("Escape")
        page.locator("#editor-launch").click()
    page.locator('[name="recipient"]').fill("亲爱的她")
    page.locator('[name="sender"]').fill("我")
    page.locator('[name="message"]').fill('生日快乐。\n\n愿你一直开心。<script>alert("test")</script>')
    page.locator("#photo-input").set_input_files([temp / "fixture-0.png", temp / "fixture-1.png"])
    expect(page.locator(".editor-photo")).to_have_count(2)
    page.locator("#audio-input").set_input_files(temp / "fixture.wav")
    expect(page.locator("#remove-audio")).to_be_visible()
    page.locator("#apply-editor").click()
    expect(page.locator("#editor-dialog")).not_to_be_visible()
    page.reload()
    expect(page.locator('html[data-ready="true"]')).to_have_count(1)
    check("editor draft including image and audio persists after reload", "亲爱的她" in page.locator(".envelope-to").inner_text())
    page.locator("#open-envelope").click()
    expect(page.locator("#letter")).to_be_visible(timeout=6000)
    expect(page.locator(".photo-item")).to_have_count(2)
    check("configured background audio starts on the opening gesture", page.locator("#background-music").evaluate("a => !a.paused && a.currentTime > 0"))
    check("message markup is treated as plain text", page.locator("#birthday-message script").count() == 0)
    page.locator("#music-toggle").click()
    check("background audio can be paused", page.locator("#background-music").evaluate("a => a.paused"))
    page.locator(".photo-item").first.click()
    expect(page.locator("#photo-dialog")).to_be_visible()
    page.keyboard.press("ArrowRight")
    check("photo viewer supports keyboard navigation", page.locator("#lightbox-caption").inner_text().startswith("02 / 02"))
    page.keyboard.press("Escape")
    expect(page.locator("#photo-dialog")).not_to_be_visible()

    page.locator("#editor-launch").click()
    with page.expect_download(timeout=15000) as exported:
        page.locator("#export-gift").click()
    export_path = temp / "index.html"
    exported.value.save_as(export_path)
    html = export_path.read_text()
    check("export embeds photos, audio, CSS and app code", all(part in html for part in ['data:image/jpeg;base64,', 'data:audio/wav;base64,', 'id="gift-styles"', 'id="gift-app"']))
    # A fresh browser context has no editor storage and is denied all HTTP access.
    offline = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, reduced_motion="reduce")
    external_requests = []
    def offline_route(route):
        # Fulfill only the top-level exported HTML; any external dependency fails.
        if route.request.url == "http://127.0.0.1:4179/":
            route.fulfill(body=html, content_type="text/html; charset=utf-8")
        else:
            external_requests.append(route.request.url)
            route.abort()
    offline.route("http://**/*", offline_route)
    offline.route("https://**/*", offline_route)
    recipient = offline.new_page()
    recipient.on("pageerror", lambda error: errors.append(str(error)))
    recipient.goto("http://127.0.0.1:4179/")
    expect(recipient.locator('html[data-ready="true"]')).to_have_count(1)
    check("exported file opens offline in a fresh recipient context", "亲爱的她" in recipient.locator(".envelope-to").inner_text())
    expect(recipient.locator("#editor-launch")).to_be_hidden()
    settle(recipient)
    recipient.screenshot(path=RESULTS / "mobile-envelope.png", full_page=True)
    recipient.locator("#open-envelope").click()
    expect(recipient.locator("#letter")).to_be_visible()
    check("reduced-motion preference opens the letter immediately", recipient.locator("#invitation").is_hidden())
    recipient.locator("#accept-gift").click()
    expect(recipient.locator("#status")).to_contain_text("归你啦")
    recipient.locator("#accept-gift").click()
    expect(recipient.locator("#status")).to_contain_text("已经替你收好")
    check("repeat acceptance works on touch devices with reduced motion", recipient.locator("#status").is_visible() and recipient.locator("#accept-gift").get_attribute("aria-pressed") == "true")
    check("reduced-motion acceptance avoids confetti", recipient.locator("#celebration i").count() == 0)
    expect(recipient.locator(".photo-item img")).to_have_count(2)
    check("embedded recipient photos really decode", recipient.locator(".photo-item img").first.evaluate("async img => { await img.decode(); return img.naturalWidth > 0; }"))
    check("exported recipient page requires no external network resources", external_requests == [])
    check("mobile page has no horizontal overflow", recipient.evaluate("document.documentElement.scrollWidth <= innerWidth"))
    recipient.screenshot(path=RESULTS / "mobile-letter-with-test-fixtures.png", full_page=True)
    for width in [320, 375, 768]:
        recipient.set_viewport_size({"width": width, "height": 844})
        check(f"letter fits {width}px width", recipient.evaluate("document.documentElement.scrollWidth <= innerWidth"))
    check("no browser JavaScript exceptions", errors == [])
    browser.close()

(RESULTS / "summary.json").write_text(json.dumps({"passed": len(checks), "checks": checks}, indent=2, ensure_ascii=False) + "\n")
print(json.dumps({"passed": len(checks), "checks": checks}, indent=2, ensure_ascii=False))
