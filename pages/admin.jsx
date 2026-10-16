import LegacyPage, { legacyProps } from '../components/LegacyPage';
import page from '../content/pages/admin.json';
export const config = { unstable_runtimeJS: false };
export const getStaticProps = () => legacyProps(page);
export default function Admin({ page }) { return <LegacyPage page={page} />; }
