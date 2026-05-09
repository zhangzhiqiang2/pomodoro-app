const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, Notification } = require('electron');
const path = require('path');
const zlib = require('zlib');

let mainWindow;
let tray;

// 用纯 Node.js 生成 16x16 RGBA PNG buffer（圆形图标）
function createTrayIconBuffer(state) {
  const colors = { idle: [136, 136, 136], work: [231, 76, 60], rest: [46, 204, 113] };
  const [r, g, b] = colors[state] || colors.idle;
  const size = 16;

  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    crcTable[n] = c;
  }
  const crc32 = (buf) => {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  };
  const makeChunk = (type, data) => {
    const tb = Buffer.from(type, 'ascii');
    const crcVal = Buffer.alloc(4);
    crcVal.writeUInt32BE(crc32(Buffer.concat([tb, data])));
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    return Buffer.concat([len, tb, data, crcVal]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // RGBA

  const rowSize = 1 + size * 4;
  const raw = Buffer.alloc(size * rowSize);
  for (let y = 0; y < size; y++) {
    raw[y * rowSize] = 0;
    for (let x = 0; x < size; x++) {
      const dx = x - size / 2 + 0.5, dy = y - size / 2 + 0.5;
      const inside = Math.sqrt(dx * dx + dy * dy) <= size / 2 - 0.5;
      const off = y * rowSize + 1 + x * 4;
      raw[off] = inside ? r : 0;
      raw[off + 1] = inside ? g : 0;
      raw[off + 2] = inside ? b : 0;
      raw[off + 3] = inside ? 255 : 0;
    }
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', zlib.deflateSync(raw)),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 380,
    height: 600,
    minHeight: 520,
    resizable: false,
    frame: false,
    transparent: false,
    backgroundColor: '#0f0a1e',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    show: false,
  });

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', (e) => {
    e.preventDefault();
    mainWindow.hide();
  });
}

function createTray() {
  const icon = nativeImage.createFromBuffer(createTrayIconBuffer('idle'));
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示窗口',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setToolTip('番茄钟');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}


ipcMain.on('timer-state', (event, state) => {
  if (tray) {
    const icon = nativeImage.createFromBuffer(createTrayIconBuffer(state));
    tray.setImage(icon);
    const tips = { idle: '番茄钟 - 空闲', work: '番茄钟 - 专注中', rest: '番茄钟 - 休息中' };
    tray.setToolTip(tips[state] || '番茄钟');
  }
});

ipcMain.on('resize-window', (event, expand) => {
  if (mainWindow) mainWindow.setSize(380, expand ? 650 : 600, true);
});

ipcMain.on('notify', (event, { title, body }) => {
  if (Notification.isSupported()) {
    new Notification({ title, body, silent: false }).show();
  }
});

ipcMain.on('minimize-window', () => {
  if (mainWindow) mainWindow.hide();
});

ipcMain.on('close-window', () => {
  if (mainWindow) mainWindow.hide();
});

app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on('window-all-closed', (e) => {
  e.preventDefault();
});

app.on('before-quit', () => {
  mainWindow.removeAllListeners('close');
});
