function relationshipProfileReference(username) {
  const normalizedUsername = String(username ?? '')
    .trim()
    .replace(/^@+/, '')
    .trim();

  return normalizedUsername ? `@${normalizedUsername}` : 'this person';
}

export function relationshipAccordionLabel(direction, username, isOwn = false) {
  if (isOwn) {
    return direction === 'followers'
      ? 'The people who want to see me'
      : 'The people I want to see';
  }

  const profileReference = relationshipProfileReference(username);

  if (direction === 'followers') {
    return `The people who want to see ${profileReference}`;
  }
  return `The people ${profileReference} wants to see`;
}

export function filterRelationshipPeople(people, query) {
  const term = String(query || '').trim().toLowerCase().replace(/^@/, '');
  if (!term) return people;
  return people.filter((person) => {
    const name = String(person.fullName || person.name || '').toLowerCase();
    const username = String(person.username || '').toLowerCase().replace(/^@/, '');
    return name.includes(term) || username.includes(term);
  });
}

export function mergeRelationshipPeople(...groups) {
  const merged = [];
  const seen = new Set();
  for (const person of groups.flat()) {
    if (!person) continue;
    const identity = String(person.id || person.username || '');
    if (!identity || seen.has(identity)) continue;
    seen.add(identity);
    merged.push(person);
  }
  return merged;
}

export async function collectRelationshipPages(loadPage, { cursor = null, maxPages = 200 } = {}) {
  const people = [];
  const requestedCursors = new Set();
  let nextCursor = cursor;
  let pagesLoaded = 0;

  do {
    const cursorKey = nextCursor || '__first_page__';
    if (requestedCursors.has(cursorKey)) {
      throw new Error('The people list repeated a page. Please try again.');
    }
    requestedCursors.add(cursorKey);

    const payload = await loadPage(nextCursor);
    people.push(...(payload?.people || []));
    nextCursor = payload?.nextCursor || null;
    pagesLoaded += 1;
  } while (nextCursor && pagesLoaded < maxPages);

  return {
    people: mergeRelationshipPeople(people),
    nextCursor,
  };
}
