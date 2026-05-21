// 引入 Electron 的核心模块
// app:           控制整个应用的生命周期（启动、退出等）
// BrowserWindow: 创建桌面窗口

// Menu:          右键菜单
// nativeImage:   原生图片对象（用于托盘图标）
// ipcMain:       主进程与渲染进程通信
// Notification:  系统桌面通知
const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, Notification } = require('electron');
const path = require('path');

// 全局变量：在 createWindow 外面声明，确保整个文件都能访问
let mainWindow;   // 主窗口对象
let tray;         // 系统托盘对象
let isQuitting = false;  // 标记：用户是否真的想退出（防止误关窗口）

/**
 * 创建番茄钟主窗口
 * 特点：
 *   - 无边框窗口（frame: false） → 使用自定义标题栏
 *   - 透明背景（transparent: true） → 实现圆角+暗黑视觉效果
 *   - 不可调整大小（resizable: false） → 保持固定尺寸 420×580
 *   - 关闭窗口其实是隐藏到托盘，而非真正退出
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,           // 窗口宽度
    height: 580,          // 窗口高度
    resizable: false,     // 禁止拖拽边缘调整大小
    frame: false,         // 去掉系统默认的标题栏边框
    transparent: true,    // 背景透明（配合CSS渐变实现圆角暗色效果）
    alwaysOnTop: false,   // 不强制置顶
    webPreferences: {
      // preload 脚本路径：在渲染进程加载之前执行，暴露安全API
      preload: path.join(__dirname, 'preload.js'),
      // 安全关键：contextIsolation=true + nodeIntegration=false
      // 防止渲染进程直接访问 Node.js，只能用 preload 暴露的 API
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),  // 窗口图标
    show: false  // 初始不显示，等页面加载完再显示（避免白屏闪烁）
  });

  // 判断开发/生产模式
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    // 开发模式：加载 Vite 开发服务器
    mainWindow.loadURL('http://localhost:1420');
    // 可选：打开开发者工具
    // mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // 生产模式：加载打包后的文件
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  // ready-to-show 事件：页面渲染完成后才显示窗口，避免白屏
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // 关键设计：点击关闭按钮 = 隐藏到托盘，不是退出程序
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      // 用户没有点托盘菜单的「退出」，阻止窗口关闭
      event.preventDefault();
      // 把窗口藏起来（仍然在托盘运行）
      mainWindow.hide();
    }
    // 如果 isQuitting 为 true，则正常关闭（进入 closed 事件）
  });

  // 窗口关闭后清理引用
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * 创建系统托盘图标
 * - 右键弹出菜单：显示番茄钟 / 退出
 * - 双击托盘图标：显示窗口
 */
function createTray() {
  const iconSize = 32;
  const icon = nativeImage.createEmpty();

  // 尝试加载自定义托盘图标；如果文件不存在则用空白图标作为降级方案
  try {
    const trayIcon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'tray-icon.png'));
    if (!trayIcon.isEmpty()) {
      // 找到了图标文件，用它
      tray = new Tray(trayIcon.resize({ width: iconSize, height: iconSize }));
    } else {
      // 图标文件是空的，用空白图
      tray = new Tray(icon.resize({ width: iconSize, height: iconSize }));
    }
  } catch {
    // 图标文件不存在等异常情况，用空白图
    tray = new Tray(icon.resize({ width: iconSize, height: iconSize }));
  }

  // 构建右键菜单
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示番茄钟',
      click: () => {
        if (mainWindow) {
          mainWindow.show();    // 让隐藏的窗口重新显示
          mainWindow.focus();   // 窗口获取焦点
        }
      }
    },
    { type: 'separator' },  // 分隔线
    {
      label: '退出',
      click: () => {
        isQuitting = true;  // 标记为真正退出
        app.quit();         // 触发关闭流程（此时 close 事件不会阻止）
      }
    }
  ]);

  tray.setToolTip('番茄钟');       // 鼠标悬停时显示的文字
  tray.setContextMenu(contextMenu); // 绑定右键菜单

  // 双击托盘图标 → 显示窗口
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ============================================================
// IPC 通信处理（渲染进程通过 preload.js 发过来的指令）
// ============================================================

// 渲染进程要求最小化窗口
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

// 渲染进程要求关闭窗口 → 隐藏到托盘
ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.hide();
});

// 渲染进程要求弹出系统通知（番茄钟时间到）
ipcMain.on('show-notification', (event, { title, body }) => {
  if (Notification.isSupported()) {
    const notif = new Notification({ title, body });
    notif.show();
    // 点击通知 → 弹出窗口
    notif.on('click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  }
});

// ============================================================
// 应用启动 & 生命周期
// ============================================================

// app.whenReady() 返回 Promise，Electron 初始化完成后执行
app.whenReady().then(() => {
  createWindow();  // 打开主窗口
  createTray();    // 创建托盘图标

  // macOS 特殊处理：点击 Dock 图标时如果窗口已被关闭则重新创建
  // 在 Windows 上这个事件也会触发（最小化后点击任务栏图标）
  app.on('activate', () => {
    if (mainWindow === null) {
      createWindow();
    } else {
      mainWindow.show();
    }
  });
});

// 在退出流程开始前就设置标志，确保 close 事件不会阻止退出
app.on('before-quit', () => {
  isQuitting = true;
});

// 所有窗口都关闭后的处理
// macOS 习惯窗口关闭后程序仍在运行，Windows 则直接退出
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
