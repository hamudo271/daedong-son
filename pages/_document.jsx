import { Html, Head, Main, NextScript } from 'next/document';

export default function Document({ __NEXT_DATA__ }) {
  const p = __NEXT_DATA__?.props?.pageProps?.page || {};
  const bodyProps = {};
  if (p.bodyClass) bodyProps.className = p.bodyClass;
  if (p.form) bodyProps['data-form'] = p.form;
  return (
    <Html lang="ko">
      <Head />
      <body {...bodyProps}>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
