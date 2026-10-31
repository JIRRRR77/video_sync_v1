/* A private, dependency-free birthday letter. No analytics or remote uploads. */
(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const template = "<!doctype html>\n" + document.documentElement.outerHTML;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const editing = new URLSearchParams(location.search).has("edit");
  const defaults = {
    recipient: "最特别的你", sender: "一直偏爱你的人", title: "生日快乐。",
    subtitle: "愿你尽兴，愿你自由。", amount: 3000,
    message: "想了很久，该送你一份什么样的礼物。\n\n后来觉得，比起替你挑选，不如把选择的快乐也一起送给你。\n\n去买那件让你一眼心动的衣服吧。穿喜欢的衣服，见想见的人，过自己喜欢的生活。\n\n新的一岁，愿你的每一个普通日子，都有值得期待的小事。而我，会继续认真收藏，所有与你有关的时刻。",
    voucherNote: "挑你喜欢的，剩下的交给我。", photos: [],
    music: { title: "Close to you", artist: "藤井 風", src: "", listenUrl: "https://music.youtube.com/search?q=Fujii+Kaze+Close+to+you" },
  };
  let config, draft, openState = "closed", photoIndex = 0, toastTimer, celebrationTimer, dragIndex = null;
  let accepted = false, fileOperations = 0;
  const audio = $("#background-music");

  function safeMedia(value, kind) {
    if (typeof value !== "string" || !value.trim()) return "";
    const source = value.trim();
    const dataType = kind === "image" ? /^data:image\/(jpeg|png|webp|avif);base64,/i : /^data:audio\/[a-z0-9.+-]+;base64,/i;
    if (dataType.test(source)) return source;
    try {
      const url = new URL(source, location.href);
      if (url.protocol === "https:" || url.protocol === "http:") return url.href;
    } catch { /* Invalid URLs remain unset. */ }
    return "";
  }

  function normalize(value) {
    const input = value && typeof value === "object" ? value : {};
    const output = structuredClone(defaults);
    for (const key of ["recipient", "sender", "title", "subtitle", "message", "voucherNote"]) {
      if (typeof input[key] === "string" && input[key].trim()) output[key] = input[key].trim().slice(0, key === "message" ? 2500 : 100);
    }
    if (Number.isInteger(Number(input.amount)) && Number(input.amount) > 0 && Number(input.amount) <= 999999) output.amount = Number(input.amount);
    if (Array.isArray(input.photos)) {
      output.photos = input.photos.slice(0, 9).map((photo, index) => ({
        src: safeMedia(typeof photo === "string" ? photo : photo?.src, "image"),
        caption: typeof photo?.caption === "string" ? photo.caption.slice(0, 100) : `值得收藏的瞬间 ${String(index + 1).padStart(2, "0")}`,
      })).filter((photo) => photo.src);
    }
    if (input.music && typeof input.music === "object") {
      for (const key of ["title", "artist"]) if (typeof input.music[key] === "string") output.music[key] = input.music[key].slice(0, 100);
      output.music.src = safeMedia(input.music.src, "audio");
      try {
        const url = new URL(input.music.listenUrl);
        if (url.protocol === "https:") output.music.listenUrl = url.href;
      } catch { /* Keep the working music-platform search link. */ }
    }
    return output;
  }

  function toast(message) {
    clearTimeout(toastTimer);
    $("#status").textContent = message;
    $("#status").classList.add("is-visible");
    toastTimer = setTimeout(() => $("#status").classList.remove("is-visible"), 4200);
  }

  function render() {
    document.querySelectorAll("[data-recipient]").forEach((el) => { el.textContent = config.recipient; });
    $("#birthday-title").textContent = config.title;
    $("#greeting-subtitle").textContent = config.subtitle;
    $("#sender").textContent = config.sender;
    $("#voucher-amount").textContent = config.amount.toLocaleString("en-US");
    $("#voucher-note").textContent = config.voucherNote;
    $("#birthday-message").replaceChildren(...config.message.split(/\n\s*\n/).map((text) => {
      const p = document.createElement("p"); p.textContent = text; return p;
    }));
    $("#memories").hidden = config.photos.length === 0;
    $("#photo-grid").replaceChildren(...config.photos.map((photo, index) => {
      const button = document.createElement("button");
      button.type = "button"; button.className = "photo-item";
      button.dataset.index = String(index + 1).padStart(2, "0");
      button.setAttribute("aria-label", `查看照片：${photo.caption}`);
      const image = document.createElement("img");
      image.src = photo.src; image.alt = photo.caption; image.loading = "lazy"; image.decoding = "async";
      button.append(image); button.addEventListener("click", () => openPhoto(index));
      return button;
    }));
    $(".track-title").textContent = config.music.title;
    $(".track-artist").textContent = config.music.artist;
    $(".music-caption").textContent = config.music.title.toUpperCase();
    $("#listen-link").href = config.music.listenUrl;
    if (audio.getAttribute("src") !== config.music.src) {
      audio.pause();
      if (config.music.src) audio.src = config.music.src;
      else { audio.removeAttribute("src"); audio.load(); }
    }
    audio.volume = 0.42;
    updateMusicState();
    $("#voucher").setAttribute("aria-label", `${config.amount}元服装代金券，送给${config.recipient}，${config.voucherNote}`);
  }

  function updateMusicState() {
    const playing = Boolean(config?.music.src && !audio.paused);
    $("#music-toggle").classList.toggle("is-playing", playing);
    $(".music-state").textContent = config?.music.src ? (playing ? "Ⅱ" : "▷") : "↗";
    $("#music-toggle").setAttribute("aria-label", config?.music.src ? `${playing ? "暂停" : "播放"}背景音乐：${config.music.title}` : `聆听 ${config?.music.title || "Close to you"}`);
    if (config?.music.src) $("#music-toggle").setAttribute("aria-pressed", String(playing));
    else $("#music-toggle").removeAttribute("aria-pressed");
  }

  function playMusic() {
    if (!config.music.src || !audio.paused) return;
    // Called directly from the envelope click, before any timer or await.
    audio.play().then(updateMusicState).catch(() => {
      updateMusicState(); toast("音乐还没有响起，轻触右上角再试一次。");
    });
  }

  function openLetter() {
    if (openState !== "closed") return;
    openState = "opening";
    $("#open-envelope").disabled = true;
    $("#open-prompt").disabled = true;
    $("#open-envelope").setAttribute("aria-expanded", "true");
    playMusic();
    $("#invitation").classList.add("is-opening");
    const duration = reducedMotion.matches ? 0 : 1500;
    setTimeout(() => $("#invitation").classList.add("is-leaving"), Math.max(0, duration - 350));
    setTimeout(() => {
      $("#invitation").hidden = true;
      $("#letter").hidden = false;
      openState = "open";
      window.scrollTo({ top: 0, behavior: "instant" });
      $("#birthday-title").tabIndex = -1;
      $("#birthday-title").focus({ preventScroll: true });
    }, duration);
  }

  function closeLetter(event) {
    event?.preventDefault();
    if (openState === "opening") return;
    $("#letter").hidden = true;
    $("#invitation").hidden = false;
    $("#invitation").classList.remove("is-opening", "is-leaving");
    $("#open-envelope").disabled = false;
    $("#open-prompt").disabled = false;
    $("#open-envelope").setAttribute("aria-expanded", "false");
    openState = "closed";
    window.scrollTo({ top: 0, behavior: "instant" });
    $("#open-envelope").focus({ preventScroll: true });
  }

  function celebrate() {
    const firstTime = !accepted;
    accepted = true;
    $("#accept-gift").replaceChildren(document.createTextNode("已收好这份心意 ♡"));
    $("#accept-gift").classList.add("is-accepted");
    $("#accept-gift").setAttribute("aria-pressed", "true");
    toast(firstTime ? "这份偏爱，归你啦。记得找我兑现 ♡" : "已经替你收好啦，这份偏爱一直为你保留 ♡");
    clearTimeout(celebrationTimer);
    if (reducedMotion.matches) {
      $("#celebration").replaceChildren();
      return;
    }
    const pieces = Array.from({ length: 42 }, () => {
      const piece = document.createElement("i");
      const random = (min, max) => Math.random() * (max - min) + min;
      piece.style.cssText = `--x:${random(4,96)}%;--w:${random(3,7)}px;--h:${random(6,14)}px;--c:${["#fff", "#999", "#cecece"][Math.floor(random(0,3))]};--drift:${random(-100,100)}px;--rotation:${random(-400,400)}deg;--duration:${random(2.8,4.8)}s;--delay:${random(0,.5)}s`;
      return piece;
    });
    $("#celebration").replaceChildren(...pieces);
    celebrationTimer = setTimeout(() => $("#celebration").replaceChildren(), 5500);
  }

  function openPhoto(index) {
    photoIndex = (index + config.photos.length) % config.photos.length;
    const photo = config.photos[photoIndex];
    $("#lightbox-image").src = photo.src;
    $("#lightbox-image").alt = photo.caption;
    $("#lightbox-caption").textContent = `${String(photoIndex + 1).padStart(2, "0")} / ${String(config.photos.length).padStart(2, "0")} — ${photo.caption}`;
    $("#photo-prev").hidden = $("#photo-next").hidden = config.photos.length < 2;
    if (!$("#photo-dialog").open) $("#photo-dialog").showModal();
  }

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function createVoucherCanvas() {
    // Export a complete landscape ticket at a fixed print layout, including its
    // stub. A phone's narrow viewport must not crop or rearrange the saved gift.
    const width = 1200, height = 432, margin = 16, scale = 2, divider = 1020;
    const canvas = document.createElement("canvas");
    canvas.width = (width + margin * 2) * scale;
    canvas.height = (height + margin * 2) * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    const voucherStyle = getComputedStyle($("#voucher"));
    const paper = getComputedStyle($("#letter")).backgroundColor;
    const sans = getComputedStyle($("#voucher-note")).fontFamily;
    const serif = getComputedStyle($(".voucher-type")).fontFamily;
    const numberFont = getComputedStyle($("#voucher-amount")).fontFamily;
    const content = (selector) => $(selector).textContent.trim();

    ctx.scale(scale, scale);
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, width + margin * 2, height + margin * 2);
    ctx.translate(margin, margin);
    ctx.fillStyle = voucherStyle.backgroundColor;
    ctx.fillRect(0, 0, width, height);

    function textLine(text, x, y, size, font, color, spacing = 0, maxWidth = width, align = "left") {
      ctx.font = `${size}px ${font}`;
      ctx.fillStyle = color;
      const chars = Array.from(text);
      const length = chars.reduce((total, char) => total + ctx.measureText(char).width, 0) + Math.max(0, chars.length - 1) * spacing;
      const fit = length ? Math.min(1, maxWidth / length) : 1;
      const offset = align === "center" ? length * fit / 2 : align === "right" ? length * fit : 0;
      ctx.save();
      ctx.translate(x - offset, y);
      ctx.scale(fit, 1);
      let cursor = 0;
      for (const char of chars) {
        ctx.fillText(char, cursor, 0);
        cursor += ctx.measureText(char).width + spacing;
      }
      ctx.restore();
    }

    textLine(content(".voucher-top > span"), 50, 70, 10.5, sans, "#999", 3);
    textLine(content(".voucher-type"), 50, 139, 22, serif, "#e5e5e5", 6);
    textLine(content(".voucher-value > span:first-child"), 50, 279, 38, numberFont, "#e5e5e5");
    ctx.font = `118px ${numberFont}`;
    ctx.fillStyle = "#e5e5e5";
    const amount = content("#voucher-amount");
    const amountWidth = Math.min(ctx.measureText(amount).width, 790);
    ctx.fillText(amount, 98, 279, 790);
    textLine(content(".voucher-currency"), 98 + amountWidth + 24, 279, 11, sans, "#888", 1.5);
    textLine(content("#voucher-note"), 50, 330, 15, sans, "#aaa", 1.5, 915);
    textLine(content(".voucher-bottom > span:first-child"), 50, 391, 9, sans, "#7e7e7e", 1, 760);
    textLine(content(".voucher-bottom > span:last-child"), divider - 50, 391, 9, sans, "#7e7e7e", 1.4, 140, "right");

    // The same fine-line star as the upper-right corner of the on-page ticket.
    ctx.save();
    ctx.translate(divider - 63, 64);
    ctx.strokeStyle = "#b7b7b7";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (let index = 0; index < 4; index++) {
      const angle = index * Math.PI / 4;
      ctx.moveTo(-19 * Math.cos(angle), -19 * Math.sin(angle));
      ctx.lineTo(19 * Math.cos(angle), 19 * Math.sin(angle));
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = "#5a5a5a";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(divider, 0);
    ctx.lineTo(divider, height);
    ctx.stroke();
    ctx.setLineDash([]);

    const stubCenter = (divider + width) / 2;
    const stubLabel = content(".stub-label");
    const split = stubLabel.lastIndexOf(" ");
    const stubLines = split > 0 ? [stubLabel.slice(0, split), stubLabel.slice(split + 1)] : [stubLabel];
    ctx.save();
    ctx.translate(stubCenter + 10, 72);
    ctx.rotate(Math.PI / 2);
    stubLines.forEach((line, index) => textLine(line, 0, index * 21, 10, sans, "#999", 3));
    ctx.restore();

    // Decorative barcode, matching the on-page repeating stripe pattern.
    const barcodeWidth = 84, barcodeX = stubCenter - barcodeWidth / 2;
    ctx.fillStyle = "#777";
    for (let offset = 0; offset < barcodeWidth; offset += 24) {
      for (const [start, end] of [[0, 1.5], [4.5, 7.5], [9, 10.5], [15, 19.5]]) {
        const left = offset + start;
        if (left < barcodeWidth) ctx.fillRect(barcodeX + left, 282, Math.min(end - start, barcodeWidth - left), 41);
      }
    }
    textLine(content(".stub-love"), stubCenter, 375, 9, sans, "#b4b4b4", 1.4, 150, "center");

    // Cut both semicircular perforations out of the complete ticket edge.
    ctx.fillStyle = paper;
    for (const y of [0, height]) {
      ctx.beginPath();
      ctx.arc(divider, y, 15, 0, Math.PI * 2);
      ctx.fill();
    }
    return canvas;
  }

  async function saveVoucher() {
    const button = $("#save-voucher"); button.disabled = true;
    try {
      await document.fonts.ready;
      const canvas = createVoucherCanvas();
      const blob = await new Promise((resolve) => canvas.toBlob(resolve,"image/png"));
      if (!blob) throw new Error("Canvas export failed");
      download(blob,"生日礼品券.png"); toast("整张礼品券已生成，愿你每次穿上都开心。");
    } catch { toast("暂时无法保存，也可以截图收藏这份心意。"); }
    finally { button.disabled = false; }
  }

  function connectDB() {
    return new Promise((resolve,reject) => {
      const request = indexedDB.open("dear-you-gift-editor",1);
      request.onupgradeneeded = () => request.result.createObjectStore("drafts");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function draftStorage(value) {
    const db = await connectDB();
    try {
      return await new Promise((resolve,reject) => {
        const transaction = db.transaction("drafts",value === undefined ? "readonly" : "readwrite");
        const store = transaction.objectStore("drafts");
        const request = value === undefined ? store.get("current") : store.put(value,"current");
        transaction.oncomplete = () => resolve(request.result);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    } finally { db.close(); }
  }

  function showEditorPhotos() {
    $("#editor-photos").replaceChildren(...draft.photos.map((photo,index) => {
      const item = document.createElement("div"); item.className = "editor-photo"; item.draggable = true;
      const image = document.createElement("img");image.src=photo.src;image.alt=`照片 ${index+1}`;
      const remove = document.createElement("button");remove.type="button";remove.textContent="×";remove.setAttribute("aria-label",`移除照片 ${index+1}`);
      remove.addEventListener("click",() => { draft.photos.splice(index,1);showEditorPhotos(); });
      item.append(image,remove);
      item.addEventListener("dragstart",(event) => { dragIndex=index;event.dataTransfer.setData("text/plain",String(index)); });
      item.addEventListener("dragover",(event) => event.preventDefault());
      item.addEventListener("drop",(event) => {
        event.preventDefault();
        if (dragIndex === null || dragIndex === index) return;
        const [photoToMove]=draft.photos.splice(dragIndex,1);draft.photos.splice(index,0,photoToMove);dragIndex=null;showEditorPhotos();
      });
      return item;
    }));
    $("#remove-audio").hidden = !draft.music.src;
    $("#audio-file-name").textContent = draft.music.src ? "背景音乐已加入 · 导出时将一起打包" : "尚未添加音频，访客可前往音乐平台聆听。";
  }

  function openEditor() {
    draft = structuredClone(config);
    for (const key of ["recipient","sender","title","subtitle","message","amount","voucherNote"]) $("#editor-form").elements[key].value=draft[key];
    $("#photo-input").value="";$("#audio-input").value="";
    showEditorPhotos();$("#editor-dialog").showModal();
  }

  function syncForm() {
    const form=$("#editor-form");
    if (!form.reportValidity()) return false;
    for (const key of ["recipient","sender","title","subtitle","message","voucherNote"]) {
      const value=form.elements[key].value.trim();
      if (!value) { toast("把心意写完整，再送给她吧。");form.elements[key].focus();return false; }
      draft[key]=value;
    }
    draft.amount=Number(form.elements.amount.value);
    return true;
  }

  async function applyDraft(close=true) {
    if (fileOperations) { toast("素材还在处理中，请稍等一下。");return false; }
    if (!syncForm()) return false;
    config=normalize(draft);render();
    try { await draftStorage(config); }
    catch { toast("本机存储不可用，当前预览仍有效。请导出网页保存心意。"); }
    if (close) { $("#editor-dialog").close();toast("心意已保存在本机。导出后，照片和音乐才能随网页一起分享。"); }
    return true;
  }

  function readFile(file) {
    return new Promise((resolve,reject) => {
      const reader=new FileReader();reader.onload=() => resolve(reader.result);reader.onerror=() => reject(reader.error);reader.readAsDataURL(file);
    });
  }

  async function compressPhoto(file) {
    if (!/^image\/(jpeg|png|webp|avif)$/.test(file.type) || file.size > 25*1024*1024) throw new Error("图片格式不支持，或超过 25 MB。");
    const bitmap=await createImageBitmap(file);
    try {
      const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
      const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
      const ctx=canvas.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
      return {src:canvas.toDataURL("image/jpeg",.86),caption:`值得收藏的瞬间 ${String(draft.photos.length+1).padStart(2,"0")}`};
    } finally { bitmap.close(); }
  }

  async function exportGift() {
    const button=$("#export-gift");
    if (!await applyDraft(false)) return;
    button.disabled=true;
    try {
      const getSource=async (id,path) => {
        const inline=document.getElementById(id);
        if (inline) return inline.textContent;
        const response=await fetch(path);
        if (!response.ok) throw new Error("Missing source file");
        return response.text();
      };
      const [css,js]=await Promise.all([getSource("gift-styles","styles.css"),getSource("gift-app","app.js")]);
      const packed = structuredClone(config);
      const embedMedia = async (src) => {
        if (src.startsWith("data:")) return src;
        const response = await fetch(src);
        if (!response.ok) throw new Error("Unable to embed media");
        const blob = await response.blob();
        return readFile(blob);
      };
      await Promise.all(packed.photos.map(async (photo) => { photo.src = await embedMedia(photo.src); }));
      if (packed.music.src) packed.music.src = await embedMedia(packed.music.src);
      const doc=new DOMParser().parseFromString(template,"text/html");
      const style=doc.createElement("style");style.id="gift-styles";style.textContent=css.replace(/<\/style/gi,"<\\/style");
      (doc.querySelector('link[rel="stylesheet"]') || doc.getElementById("gift-styles")).replaceWith(style);
      const script=doc.createElement("script");script.id="gift-app";script.type="module";script.textContent=js.replace(/<\/script/gi,"<\\/script");
      (doc.querySelector('script[src="app.js"]') || doc.getElementById("gift-app")).replaceWith(script);
      doc.getElementById("gift-config").textContent=JSON.stringify(packed).replace(/</g,"\\u003c");
      const html="<!doctype html>\n"+doc.documentElement.outerHTML;
      download(new Blob([html],{type:"text/html;charset=utf-8"}),"index.html");
      toast("完整网页已导出。照片、音乐和心意，都在里面了。");
    } catch { toast("网页导出失败，请通过开发服务器打开编辑页后再试。"); }
    finally { button.disabled=false; }
  }

  function bind() {
    $("#open-envelope").addEventListener("click",openLetter);
    $("#open-prompt").addEventListener("click",openLetter);
    $("#close-letter").addEventListener("click",closeLetter);
    $(".wordmark").addEventListener("click",closeLetter);
    $("#accept-gift").addEventListener("click",celebrate);
    $("#save-voucher").addEventListener("click",saveVoucher);
    $("#music-toggle").addEventListener("click",() => {
      if (config.music.src) { if (audio.paused) playMusic(); else audio.pause();return; }
      const panel=$("#music-panel");panel.hidden=!panel.hidden;
      $("#music-toggle").setAttribute("aria-expanded",String(!panel.hidden));
    });
    for (const event of ["play","pause","ended"]) audio.addEventListener(event,updateMusicState);
    audio.addEventListener("error",() => { updateMusicState();toast("音乐暂时无法播放，你仍然可以好好读完这封信。"); });
    document.addEventListener("click",(event) => {
      if (!event.target.closest("#music-toggle,#music-panel")) { $("#music-panel").hidden=true;$("#music-toggle").setAttribute("aria-expanded","false"); }
    });
    document.addEventListener("keydown",(event) => {
      if (event.key === "Escape") { $("#music-panel").hidden=true;$("#music-toggle").setAttribute("aria-expanded","false"); }
      if (!$("#photo-dialog").open) return;
      if (event.key === "ArrowRight") openPhoto(photoIndex+1);
      if (event.key === "ArrowLeft") openPhoto(photoIndex-1);
    });
    $("#close-photo").addEventListener("click",() => $("#photo-dialog").close());
    $("#photo-prev").addEventListener("click",() => openPhoto(photoIndex-1));
    $("#photo-next").addEventListener("click",() => openPhoto(photoIndex+1));
    let touchStart=0;
    $("#lightbox-image").addEventListener("touchstart",(event) => { touchStart=event.changedTouches[0].clientX; },{passive:true});
    $("#lightbox-image").addEventListener("touchend",(event) => {
      const delta=event.changedTouches[0].clientX-touchStart;
      if (Math.abs(delta)>45) openPhoto(photoIndex+(delta<0?1:-1));
    },{passive:true});
    for (const dialog of [$("#photo-dialog"),$("#editor-dialog")]) {
      dialog.addEventListener("click",(event) => {
        if (event.target!==dialog) return;
        if (dialog.id === "editor-dialog" && fileOperations) return;
        const rect=dialog.getBoundingClientRect();
        if (event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom) dialog.close();
      });
    }
    if (!editing) return;
    $("#editor-launch").hidden=false;
    $("#editor-launch").addEventListener("click",openEditor);
    $("#close-editor").addEventListener("click",() => { if (!fileOperations) $("#editor-dialog").close(); });
    $("#editor-dialog").addEventListener("cancel",(event) => { if(fileOperations) event.preventDefault(); });
    $("#editor-form").addEventListener("submit",(event) => {event.preventDefault();applyDraft();});
    $("#export-gift").addEventListener("click",exportGift);
    $("#remove-audio").addEventListener("click",() => { draft.music.src="";$("#audio-input").value="";showEditorPhotos(); });
    $("#photo-input").addEventListener("change",async (event) => {
      const files=Array.from(event.target.files);fileOperations++;
      try {
        const remaining=9-draft.photos.length;
        if (files.length>remaining) toast(`最多收藏 9 张照片，本次将加入前 ${Math.max(0,remaining)} 张。`);
        for (const file of files.slice(0,remaining)) {
          try { draft.photos.push(await compressPhoto(file)); }
          catch { toast(`「${file.name}」无法读取，请使用 JPG、PNG 或 WebP 图片。`); }
        }
        showEditorPhotos();
      } finally { fileOperations--;event.target.value=""; }
    });
    $("#audio-input").addEventListener("change",async (event) => {
      const file=event.target.files[0];if(!file)return;
      if (!file.type.startsWith("audio/")||file.size>20*1024*1024) {toast("请选择 20 MB 以内的 MP3、M4A、WAV 或 OGG 音频。");event.target.value="";return;}
      fileOperations++;
      try { draft.music.src=await readFile(file);showEditorPhotos(); }
      catch { toast("音频读取失败，请重新选择文件。"); }
      finally { fileOperations--; }
    });
  }

  async function init() {
    let input;
    try { input=JSON.parse($("#gift-config").textContent); } catch { /* Use the separate config. */ }
    if (!input) {
      try {const response=await fetch("gift.config.json");if(response.ok)input=await response.json();} catch { /* Offline file fallback. */ }
    }
    config=normalize(input);
    if (editing) {
      try { const saved=await draftStorage();if(saved)config=normalize(saved); } catch { /* Export still works without storage. */ }
    }
    render();bind();document.documentElement.dataset.ready="true";
  }
  init().catch(() => toast("信件暂时没有打开，刷新页面后再试一次。"));
})();
