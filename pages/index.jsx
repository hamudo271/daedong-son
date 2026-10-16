import LegacyPage, { legacyProps } from '../components/LegacyPage';
import page from '../content/pages/home.json';
export const config = { unstable_runtimeJS: false };
export const getStaticProps = () => legacyProps(page);
export default function Home({ page }) { return <LegacyPage page={page} />; }
