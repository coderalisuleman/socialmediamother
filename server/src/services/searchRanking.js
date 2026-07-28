const STOP_WORDS = new Set(['a', 'an', 'and', 'by', 'for', 'from', 'in', 'of', 'on', 'or', 'the', 'to', 'with']);

export const normalizeSearchText = (value) => String(value || '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

export const searchTokens = (value) => normalizeSearchText(value).split(' ')
  .filter(Boolean)
  .filter((token) => !STOP_WORDS.has(token));

const editDistance = (left, right) => {
  if (left === right) return 0;
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = previous[0];
    previous[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const above = previous[rightIndex];
      previous[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + 1,
        diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return previous[right.length];
};

const tokenQuality = (queryToken, targetToken) => {
  if (queryToken === targetToken) return 1;
  if (Math.min(queryToken.length, targetToken.length) >= 2 && (targetToken.startsWith(queryToken) || queryToken.startsWith(targetToken))) return .9;
  if (Math.min(queryToken.length, targetToken.length) >= 3 && (targetToken.includes(queryToken) || queryToken.includes(targetToken))) return .72;
  if (queryToken.length < 4 || targetToken.length < 4 || Math.abs(queryToken.length - targetToken.length) > 2) return 0;
  if (queryToken.length === targetToken.length) {
    const mismatch = [...queryToken].findIndex((character, index) => character !== targetToken[index]);
    if (mismatch >= 0
      && queryToken[mismatch] === targetToken[mismatch + 1]
      && queryToken[mismatch + 1] === targetToken[mismatch]
      && queryToken.slice(mismatch + 2) === targetToken.slice(mismatch + 2)) return .78;
  }
  const similarity = 1 - editDistance(queryToken, targetToken) / Math.max(queryToken.length, targetToken.length);
  return similarity >= .66 ? similarity * .82 : 0;
};

const fieldScore = (query, text, weight) => {
  const phrase = normalizeSearchText(query);
  const target = normalizeSearchText(text);
  if (!phrase || !target) return 0;
  let score = 0;
  if (target === phrase) score += 260;
  else if (target.startsWith(phrase)) score += 145;
  else if (target.includes(phrase)) score += 90;
  const targetTokens = target.split(' ').filter(Boolean);
  for (const token of searchTokens(query)) {
    const quality = targetTokens.reduce((best, candidate) => Math.max(best, tokenQuality(token, candidate)), 0);
    score += quality * 42;
  }
  return score * weight;
};

const coverage = (query, texts) => {
  const tokens = searchTokens(query);
  if (!tokens.length) return { matched: 0, required: 0, average: 1 };
  const targetTokens = texts.flatMap((text) => normalizeSearchText(text).split(' ').filter(Boolean));
  const qualities = tokens.map((token) => targetTokens.reduce((best, candidate) => Math.max(best, tokenQuality(token, candidate)), 0));
  return {
    matched: qualities.filter((quality) => quality >= .62).length,
    required: tokens.length <= 2 ? tokens.length : Math.ceil(tokens.length * .6),
    average: qualities.reduce((total, quality) => total + quality, 0) / tokens.length,
  };
};

export const parseSearchIntent = (value) => {
  const query = String(value || '').trim().slice(0, 160);
  const byUsername = query.match(/\bby\s+@([a-z]{1,40})\b/i)?.[1]?.toLowerCase() || null;
  const exactAt = query.match(/(?:^|\s)@([a-z]{1,40})(?=\s|$)/i)?.[1]?.toLowerCase() || null;
  const trailingName = !byUsername ? query.match(/\s+by\s+([^@][^\r\n]{0,99})$/i)?.[1]?.trim() : null;
  const authorName = trailingName && normalizeSearchText(trailingName) ? trailingName : null;
  let contentQuery = query;
  if (byUsername) contentQuery = contentQuery.replace(/\s*\bby\s+@[a-z]{1,40}\b/i, ' ');
  else if (authorName) contentQuery = contentQuery.slice(0, contentQuery.toLowerCase().lastIndexOf(' by '));
  contentQuery = contentQuery.replace(/(?:^|\s)@[a-z]{1,40}(?=\s|$)/ig, ' ').replace(/\s+/g, ' ').trim();
  return { query, contentQuery, byUsername, exactAt, authorName };
};

export const rankPersonSearch = (query, user) => {
  const fields = [user?.username, user?.fullName];
  const match = coverage(query, fields);
  if (match.required && (match.matched < match.required || match.average < .58)) return 0;
  return fieldScore(query, user?.username, 2.8) + fieldScore(query, user?.fullName, 1.8) + match.average * 80;
};

export const rankPostSearch = (query, post) => {
  if (!String(query || '').trim()) return 1;
  const fields = [post?.nameIt, post?.text, post?.detail, ...(post?.links || [])];
  const match = coverage(query, fields);
  if (match.required && (match.matched < match.required || match.average < .54)) return 0;
  return fieldScore(query, post?.nameIt, 3.8)
    + fieldScore(query, post?.text, 2.7)
    + fieldScore(query, post?.detail, 1.55)
    + fieldScore(query, (post?.links || []).join(' '), .55)
    + match.average * 110;
};

export const candidateSearchFragments = (value) => {
  const phrase = normalizeSearchText(value);
  const tokens = searchTokens(value);
  const fragments = [phrase, ...tokens];
  for (const token of tokens) {
    if (token.length < 5) continue;
    for (let index = 0; index <= token.length - 3; index += Math.max(1, token.length - 3)) fragments.push(token.slice(index, index + 3));
  }
  return fragments.filter(Boolean).filter((item, index, all) => all.indexOf(item) === index).slice(0, 14);
};
