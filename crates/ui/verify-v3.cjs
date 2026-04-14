const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const pages = [
    { path: '/chat', name: 'Chat' },
    { path: '/dashboard', name: 'Dashboard' },
    { path: '/analytics', name: 'Analytics' },
    { path: '/inspector', name: 'Inspector' },
    { path: '/files', name: 'Files' },
    { path: '/terminal', name: 'Terminal' },
    { path: '/memory', name: 'Memory' },
    { path: '/skills', name: 'Skills' },
    { path: '/cron', name: 'Cron' },
    { path: '/env', name: 'Env Vars' },
    { path: '/settings', name: 'Settings' },
  ];

  let ok = 0, fail = 0;

  for (const p of pages) {
    try {
      await page.goto('http://localhost:3848' + p.path, { waitUntil: 'networkidle', timeout: 10000 });
      const h1 = await page.$eval('h1', el => el.textContent).catch(() => 'NO_H1');
      console.log('OK  ' + p.name + ' (' + p.path + ') h1=[' + h1 + ']');
      ok++;
    } catch (e) {
      console.log('ERR ' + p.name + ' (' + p.path + '): ' + e.message.substring(0, 120));
      fail++;
    }
  }

  // Sidebar checks
  await page.goto('http://localhost:3848/chat', { waitUntil: 'networkidle' });
  const logoText = await page.$eval('.logo', el => el.textContent.trim()).catch(() => 'NOT_FOUND');
  console.log('\nLogo: [' + logoText + '] (should contain ☤)');

  const navItems = await page.$$('a.nav-item');
  console.log('Nav items: ' + navItems.length + ' (expect 11)');

  const logsPanel = await page.$eval('text=Live Logs', el => el.textContent).catch(() => 'NOT_FOUND');
  console.log('LiveLogs: ' + logsPanel);

  const sidebarText = await page.$eval('.sidebar-nav', el => el.innerText).catch(() => '');
  for (const label of ['Analytics', 'Cron', 'Env Vars']) {
    console.log('Sidebar [' + label + ']: ' + sidebarText.includes(label));
  }

  // Version in sidebar
  const version = await page.$eval('.sidebar-version', el => el.textContent).catch(() => 'NOT_FOUND');
  console.log('Version: ' + version);

  await browser.close();
  console.log('\nResults: ' + ok + ' OK, ' + fail + ' FAIL');
  process.exit(fail > 0 ? 1 : 0);
})();
