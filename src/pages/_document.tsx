import { Html, Head, Main, NextScript } from 'next/document';

// Light is the default theme; dark is opt-in via the ThemeToggle in the
// Header, persisted in localStorage. This runs synchronously before the
// page paints, so a returning visitor who picked dark never sees a flash of
// the light theme first (the classic "FOUC" with class-based dark mode).
const THEME_INIT_SCRIPT = `
(function() {
  try {
    if (localStorage.getItem('walti-theme') === 'dark') {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
})();
`;

export default function Document() {
  return (
    <Html lang="es">
      <Head>
        <title>Walti</title>
        <link rel="icon" href="/favicon.png" type="image/png" />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
