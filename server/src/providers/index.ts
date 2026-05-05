import type { NewsProvider } from '../domain/news';
import { directRssProvider } from './directRssProvider';
import { gdeltProvider } from './gdeltProvider';
import { googleNewsProvider } from './googleNewsProvider';
import { naverProvider } from './naverProvider';
import { newsApiProvider } from './newsApiProvider';
import { secProvider } from './secProvider';
import { sourceSearchProvider } from './sourceSearchProvider';

export const newsProviders: NewsProvider[] = [
  directRssProvider,
  sourceSearchProvider,
  gdeltProvider,
  googleNewsProvider,
  naverProvider,
  newsApiProvider,
  secProvider
];
