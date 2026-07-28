export function relationshipAccordionLabel(direction, isOwn) {
  if (direction === 'followers') {
    return isOwn ? 'The people who want to see me' : 'The people who want to see them';
  }
  return isOwn ? 'The people I want to see' : 'The people they want to see';
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
