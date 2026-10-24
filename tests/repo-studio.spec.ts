import { test, expect, type Page } from '@playwright/test';
import {
  buildEmbedSnippets,
  buildFileName,
  buildRepoSvg,
  DEFAULT_SETTINGS,
  EXPORT_PRESETS,
  parseRepoInput,
  sanitizeSettings,
  wrapText,
  type RepoInfo,
} from '../src/utils/repoStudio';

const repo: RepoInfo = {
  owner: 'kushmanmb-eth',
  name: 'octocanvas',
  description: 'Canvas for <devs> & "friends"',
  stars: 5,
  forks: 2,
  language: 'TypeScript',
  defaultBranch: 'main',
};

test.describe('repoStudio utils', () => {
  test('parseRepoInput handles names, owner/repo and URLs', () => {
    expect(parseRepoInput('octocanvas', 'Kushmanmb')).toEqual({ owner: 'Kushmanmb', name: 'octocanvas' });
    expect(parseRepoInput('a/b', 'x')).toEqual({ owner: 'a', name: 'b' });
    expect(parseRepoInput('https://github.com/a/b.git/', 'x')).toEqual({ owner: 'a', name: 'b' });
    expect(parseRepoInput('', 'x')).toBeNull();
    expect(parseRepoInput('a/..', 'x')).toBeNull();
    expect(parseRepoInput('bad owner/b', 'x')).toBeNull();
  });

  test('buildRepoSvg uses preset dimensions and escapes text', () => {
    for (const p of EXPORT_PRESETS) {
      const svg = buildRepoSvg(repo, DEFAULT_SETTINGS, p.width, p.height);
      expect(svg).toContain(`viewBox="0 0 ${p.width} ${p.height}"`);
    }
    const svg = buildRepoSvg(repo, { ...DEFAULT_SETTINGS, title: '<script>x</script>' }, 1280, 320);
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
    expect(svg).toContain('&lt;devs&gt; &amp; &quot;friends&quot;');
  });

  test('buildRepoSvg rejects invalid colors', () => {
    const svg = buildRepoSvg(repo, { ...DEFAULT_SETTINGS, colorA: '"/><script>' }, 1280, 320);
    expect(svg).not.toContain('<script>');
  });

  test('every pattern renders', () => {
    for (const pattern of ['none', 'grid', 'dots', 'diagonal', 'squares'] as const) {
      expect(buildRepoSvg(repo, { ...DEFAULT_SETTINGS, pattern }, 1280, 640)).toContain('</svg>');
    }
  });

  test('embed snippets point at raw.githubusercontent.com and Pages', () => {
    const file = buildFileName(repo, EXPORT_PRESETS[0], 'png');
    expect(file).toBe('octocanvas-readme-banner.png');
    const s = buildEmbedSnippets(repo, { branch: 'main', folder: '../.github//assets/' }, file);
    expect(s.path).toBe('.github/assets/octocanvas-readme-banner.png');
    expect(s.markdown).toBe(
      '![octocanvas banner](https://raw.githubusercontent.com/kushmanmb-eth/octocanvas/main/.github/assets/octocanvas-readme-banner.png)'
    );
    expect(s.pagesUrl).toBe('https://kushmanmb-eth.github.io/octocanvas/octocanvas-readme-banner.png');
  });

  test('sanitizeSettings drops unknown and mistyped values', () => {
    const s = sanitizeSettings({ title: 5, colorA: '#123456', pattern: 'bogus', evil: 1 });
    expect(s.title).toBe('');
    expect(s.colorA).toBe('#123456');
    expect(s.pattern).toBe('grid');
    expect('evil' in s).toBe(false);
  });

  test('wrapText truncates with ellipsis', () => {
    const lines = wrapText('one two three four five six seven', 10, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith('…')).toBe(true);
  });
});

async function mockGitHub(page: Page) {
  const item = (owner: string, name: string) => ({
    name,
    owner: { login: owner },
    description: `${name} description`,
    stargazers_count: 3,
    forks_count: 1,
    language: 'TypeScript',
    default_branch: 'main',
  });
  await page.route('https://api.github.com/users/Kushmanmb/repos?*', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify([item('Kushmanmb', 'alpha')]) })
  );
  await page.route('https://api.github.com/users/kushmanmb-eth/repos?*', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify([item('kushmanmb-eth', 'octocanvas')]) })
  );
  await page.route('https://api.github.com/repos/someone/manual', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(item('someone', 'manual')) })
  );
}

async function openStudio(page: Page) {
  await mockGitHub(page);
  await page.goto('/');
  await page.getByRole('tab', { name: 'Repo Studio' }).click();
  await expect(page.locator('#studio-repo-select option', { hasText: 'alpha' })).toHaveCount(1);
}

test.describe('Repo Studio tab', () => {
  test('existing tabs remain available', async ({ page }) => {
    await page.goto('/');
    for (const name of ['Wallpaper', 'Devémon Card', 'README Banner', 'Repo Studio']) {
      await expect(page.getByRole('tab', { name })).toBeVisible();
    }
  });

  test('lists repositories for both owners and updates the live preview', async ({ page }) => {
    await openStudio(page);
    await expect(page.locator('#studio-repo-select optgroup')).toHaveCount(2);
    await page.locator('#studio-repo-select').selectOption('kushmanmb-eth/octocanvas');
    const preview = page.getByTestId('studio-preview');
    await expect(preview.locator('svg')).toHaveAttribute('aria-label', 'kushmanmb-eth/octocanvas');
    await page.locator('#studio-title').fill('Hello Studio');
    await expect(preview).toContainText('Hello Studio');
  });

  test('manual repository entry works', async ({ page }) => {
    await openStudio(page);
    await page.locator('#studio-repo-manual').fill('someone/manual');
    await page.getByRole('button', { name: 'Use repository' }).click();
    await expect(page.getByTestId('studio-preview').locator('svg')).toHaveAttribute('aria-label', 'someone/manual');
  });

  test('shows README embed Markdown and changes with preset', async ({ page }) => {
    await openStudio(page);
    await page.locator('#studio-repo-select').selectOption('kushmanmb-eth/octocanvas');
    await expect(page.locator('#studio-md')).toHaveValue(
      /!\[octocanvas banner\]\(https:\/\/raw\.githubusercontent\.com\/kushmanmb-eth\/octocanvas\/main\/\.github\/assets\/octocanvas-readme-banner\.png\)/
    );
    await page.getByText('Social preview').first().click();
    await expect(page.locator('#studio-md')).toHaveCount(0);
  });

  test('exports SVG and PNG', async ({ page }) => {
    await openStudio(page);
    await page.locator('#studio-repo-select').selectOption('kushmanmb-eth/octocanvas');

    await page.locator('#studio-format').selectOption('svg');
    let [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /^Download/ }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('octocanvas-readme-banner.svg');

    await page.locator('#studio-format').selectOption('png');
    await page.getByText('Mobile wallpaper').first().click();
    [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /^Download/ }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('octocanvas-mobile-wallpaper.png');
  });

  test('persists settings and custom presets locally', async ({ page }) => {
    await openStudio(page);
    await page.locator('#studio-title').fill('Persisted');
    await page.locator('#studio-preset-name').fill('Mine');
    await page.getByRole('button', { name: 'Save preset' }).click();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('octocanvas:repo-studio:presets:v1')))
      .toContain('Mine');
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('octocanvas:repo-studio:settings:v1')))
      .toContain('Persisted');
    await page.reload();
    await page.getByRole('tab', { name: 'Repo Studio' }).click();
    await expect(page.locator('#studio-title')).toHaveValue('Persisted');
    await expect(page.locator('#studio-preset-select option', { hasText: 'Mine' })).toHaveCount(1);
  });

  test('has no horizontal overflow on iPhone-sized viewports', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openStudio(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
