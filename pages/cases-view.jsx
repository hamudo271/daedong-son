import LegacyPage, { legacyProps } from '../components/LegacyPage';
import page from '../content/pages/cases-view.json';
export const config = { unstable_runtimeJS: false };
export const getStaticProps = () => legacyProps(page);
export default function CasesView({ page }) { return <LegacyPage page={page} />; }
