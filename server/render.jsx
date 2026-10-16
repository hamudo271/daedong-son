import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CaseTrack, CaseList, CaseView, PostView, CaseNotFound } from '../components/cms/Cases';

const html = (node) => renderToStaticMarkup(node).replace(/<link rel="preload" as="image"[^>]*\/?>(?:<\/link>)?/g, '');
export const caseTrackHTML = (items) => html(<CaseTrack items={items} />);
export const caseListHTML = (d, cat, kind, counts) => html(<CaseList d={d} cat={cat} kind={kind} counts={counts} />);
export const caseViewHTML = (v, preview) => html(<CaseView v={v} preview={preview} />);
export const postViewHTML = (v, preview) => html(<PostView v={v} preview={preview} />);
export const caseNotFoundHTML = () => html(<CaseNotFound />);
