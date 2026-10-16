import LegacyPage, { legacyProps } from '../components/LegacyPage';
import page from '../content/pages/404.json';
export const config = { unstable_runtimeJS: false };
export const getStaticProps = () => legacyProps(page);
export default function NotFound({ page }) { return <LegacyPage page={page} />; }
