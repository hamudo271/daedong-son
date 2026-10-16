import LegacyPage, { legacyProps } from '../components/LegacyPage';
import page from '../content/pages/contact.json';
export const config = { unstable_runtimeJS: false };
export const getStaticProps = () => legacyProps(page);
export default function Contact({ page }) { return <LegacyPage page={page} />; }
