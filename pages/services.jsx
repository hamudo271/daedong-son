import LegacyPage, { legacyProps } from '../components/LegacyPage';
import page from '../content/pages/services.json';
export const config = { unstable_runtimeJS: false };
export const getStaticProps = () => legacyProps(page);
export default function Services({ page }) { return <LegacyPage page={page} />; }
