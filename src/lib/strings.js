// Every piece of user-facing text lives here.

/** Sorts names the way a person would: ignoring case and accents, with 2 before 10 */
export const compareText = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true }).compare;

const sizes = ['kilobyte', 'megabyte', 'gigabyte', 'terabyte'].map(
  (unit) => new Intl.NumberFormat('en-GB', { style: 'unit', unit, unitDisplay: 'short', maximumFractionDigits: 1 })
);

/** @param {number} bytes such as 38 MB */
function size(bytes) {
  let value = bytes / 1000;
  let unit = 0;
  while (value >= 1000 && unit < sizes.length - 1) {
    value /= 1000;
    unit++;
  }
  return sizes[unit].format(value);
}

/**
 * @param {number} days since it happened
 * @param {string} date when it happened, written out
 * @returns {string} "today", "yesterday", "3 days ago", or "on 14 March 2024" after two weeks
 */
function ago(days, date) {
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : days < 14 ? `${days} days ago` : `on ${date}`;
}

const list = new Intl.ListFormat('en-GB');

/** What an import summary names, by table, as [one, many] */
const IMPORTED = {
  gardens: ['garden', 'gardens'],
  plants: ['plant', 'plants'],
  issues: ['problem', 'problems'],
  entries: ['entry', 'entries'],
  photos: ['photo', 'photos']
};

/**
 * @param {Record<string, number>} counts by table
 * @returns {string} such as "3 plants, 12 entries and 8 photos", or '' for none
 */
function importedCounts(counts) {
  return list.format(
    Object.entries(IMPORTED)
      .filter(([table]) => counts[table] > 0)
      .map(([table, [one, many]]) => `${counts[table]} ${counts[table] === 1 ? one : many}`)
  );
}

export const strings = {
  appName: 'Garden Journal',
  other: 'Other',

  actions: {
    reload: 'Reload',
    retry: 'Try again',
    back: 'Go back',
    dismiss: 'Dismiss',
    close: 'Close',
    edit: 'Edit',
    undo: 'Undo'
  },

  form: {
    optional: 'optional',
    /**
     * @param {number} length
     * @param {number} limit
     */
    count: (length, limit) => `${length.toLocaleString('en-GB')} of ${limit.toLocaleString('en-GB')}`
  },

  welcome: {
    title: 'Welcome to Garden Journal',
    intro: 'Start with your name and the name of your garden. You can add more gardens later.',
    personName: 'Your name',
    gardenName: 'Garden name',
    submit: 'Start the journal',
    restoreTitle: 'Moving from another device?',
    restoreHint: 'Restore your journal from a backup file made with Export.',
    restore: 'Restore a backup'
  },

  garden: {
    /** @param {number} count */
    plants: (count) => (count === 1 ? '1 plant' : `${count.toLocaleString('en-GB')} plants`),
    /** @param {number} count */
    needAttention: (count) => (count === 1 ? '1 needs attention' : `${count.toLocaleString('en-GB')} need attention`),
    filter: 'Show',
    all: 'All',
    attention: 'Needs attention',
    search: 'Search plants',
    noPlants: {
      title: 'No plants yet',
      message: 'Add the plants in this garden, and keep notes and photos for each one as the seasons go.'
    },
    noneNeedAttention: {
      title: 'Nothing needs attention',
      message: 'No plant has an open problem. Flag one from a plant’s page when you spot something.',
      action: 'Show all plants'
    },
    noResults: {
      /** @param {string} search */
      title: (search) => `No plants match “${search}”`,
      message: 'Try a name, a variety, where it grows or a tag.',
      action: 'Clear search'
    }
  },

  plantSheet: {
    addTitle: 'Add a plant',
    editTitle: 'Edit plant',
    commonName: 'Name',
    location: 'Where it grows',
    status: 'Status',
    more: 'More details',
    botanicalName: 'Botanical name',
    variety: 'Variety',
    plantedOn: 'Planted',
    quantity: 'How many',
    source: 'Where it came from',
    careNotes: 'Care notes',
    tags: 'Tags',
    tagsHint: 'Separate tags with commas.',
    save: 'Save',
    add: 'Add plant',
    cancel: 'Cancel'
  },

  gardenSheet: {
    addTitle: 'Add a garden',
    editTitle: 'Garden details',
    name: 'Name',
    status: 'Status',
    more: 'More details',
    ownerName: 'Owner',
    contact: 'Contact',
    contactHint: 'A phone number or email address.',
    address: 'Address',
    soil: 'Soil',
    aspect: 'Aspect',
    aspectHint: 'Which way it faces, such as south-west.',
    notes: 'Notes',
    save: 'Save',
    add: 'Add garden',
    cancel: 'Cancel',
    delete: 'Delete this garden',
    /** @param {string} name */
    confirmLabel: (name) => `To delete it, type “${name}”`,
    deleteWarning: 'Every plant, note and photo in this garden goes with it, and this can’t be undone.',
    deleteConfirm: 'Delete garden'
  },

  plant: {
    /** @param {string} garden */
    back: (garden) => `Back to ${garden}`,
    menu: 'Plant options',
    delete: 'Delete plant',
    location: 'Location',
    status: 'Status',
    plantedOn: 'Planted',
    careNotes: 'Care notes',
    tags: 'Tags'
  },

  gardenMenu: {
    /** @param {string} name */
    open: (name) => `${name}, switch garden`,
    gardens: 'Your gardens',
    archived: 'Archived',
    add: 'Add a garden',
    edit: 'Garden details'
  },

  toasts: {
    saved: 'Saved',
    plantAdded: 'Plant added',
    gardenAdded: 'Garden added',
    gardenDeleted: 'Garden deleted',
    plantDeleted: 'Plant deleted',
    entryDeleted: 'Entry deleted',
    problemFlagged: 'Problem flagged',
    problemDeleted: 'Problem deleted'
  },

  dates: {
    today: 'Today',
    yesterday: 'Yesterday'
  },

  issueSheet: {
    addTitle: 'Flag a problem',
    editTitle: 'Edit problem',
    saveEdit: 'Save',
    delete: 'Delete problem',
    title: 'What’s wrong',
    titleHint: 'Such as greenfly on the buds.',
    kind: 'Kind',
    firstSeen: 'First seen',
    severity: 'How bad',
    notes: 'Notes',
    save: 'Flag problem',
    cancel: 'Cancel'
  },

  issues: {
    title: 'Problems',
    flag: 'Flag a problem',
    /** @param {string} title */
    edit: (title) => `Edit problem: ${title}`,
    reopen: 'Reopen',
    /** @param {number} count */
    resolvedGroup: (count) => `Resolved (${count})`,
    /** @param {number} days since it was first seen */
    seen: (days) => (days <= 0 ? 'First seen today' : days === 1 ? 'First seen yesterday' : `First seen ${days} days ago`)
  },

  check: {
    button: 'Checked today',
    already: 'Already checked today',
    never: 'Nothing recorded yet',
    /**
     * @param {number} days since the plant's last entry
     * @param {string} date that entry's date, written out
     */
    last: (days, date) => `Last checked ${ago(days, date)}`
  },

  entry: {
    form: 'New entry',
    note: 'Note',
    notePlaceholder: 'What did you notice?',
    kind: 'Kind',
    date: 'Date',
    product: 'Product',
    productHint: 'Such as the feed or spray you used.',
    issue: 'Problem',
    noIssue: 'Not about a problem',
    save: 'Save',
    clear: 'Clear'
  },

  timeline: {
    title: 'Timeline',
    empty: {
      title: 'Nothing recorded yet',
      message: 'Checks, notes and photos appear here, newest first.'
    },
    product: 'Product',
    edited: 'Edited',
    earlier: 'Show earlier',
    /**
     * @param {string} kind
     * @param {string} day
     */
    edit: (kind, day) => `Edit ${kind} entry, ${day}`
  },

  entrySheet: {
    title: 'Edit entry',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete entry'
  },

  backup: {
    never: 'No backup yet',
    /**
     * @param {number} days since the last backup
     * @param {string} date its date, written out
     */
    last: (days, date) => `Last backup ${ago(days, date)}`,
    hint: 'One file with all your notes and photos. Keep it somewhere safe, away from this device.',
    export: 'Export',
    preparing: 'Preparing your backup',
    /**
     * @param {number} done
     * @param {number} total
     */
    progress: (done, total) => `${done} of ${total} photos`,
    ready: 'Your backup is ready',
    importTitle: 'Import a backup',
    importHint: 'Adds anything new from a backup file. Where both have the same thing, the more recent change is kept.',
    import: 'Import',
    importing: 'Importing your backup',
    /** @param {{ added: Record<string, number>, updated: Record<string, number>, skipped: number }} summary */
    imported: ({ added, updated, skipped }) => {
      const sentences = [];
      if (importedCounts(added)) sentences.push(`Added ${importedCounts(added)}.`);
      if (importedCounts(updated)) sentences.push(`Updated ${importedCounts(updated)}.`);
      if (sentences.length === 0) sentences.push('There was nothing new in this backup.');
      if (skipped) sentences.push(`${skipped === 1 ? 'One item' : `${skipped} items`} in the file couldn’t be read, so ${skipped === 1 ? 'it was' : 'they were'} left out.`);
      return sentences.join(' ');
    },
    /** @param {number} count */
    unreadable: (count) =>
      count === 1
        ? 'One photo could no longer be read on this device, so the backup leaves it out.'
        : `${count} photos could no longer be read on this device, so the backup leaves them out.`,
    save: 'Save backup'
  },

  settings: {
    title: 'Backup and settings',
    name: 'Your name',
    saveName: 'Save name',
    nameSaved: 'Name saved',
    storage: 'Storage used',
    /**
     * @param {number} usage bytes
     * @param {number} quota bytes
     */
    storageUsed: (usage, quota) => `${size(usage)} of ${size(quota)}`,
    storageUnknown: 'Not shown by this browser',
    version: 'App version',
    /** @param {number} count */
    log: (count) => `Problem log (${count})`,
    logEmpty: 'No problems logged',
    causedBy: 'Caused by',
    logHint: 'Details of anything that went wrong, to help work out why. They hold no notes, names or photos.'
  },

  update: {
    title: 'A new version of Garden Journal is ready',
    message: 'Update now to start using it. Anything you’re writing is kept.',
    action: 'Update now'
  },

  backupReminder: {
    title: 'Time for a backup',
    message: 'Your newest notes and photos are only on this device. A backup keeps them safe.',
    action: 'Back up now'
  },

  storage: {
    title: 'Your device is nearly full',
    message: 'Make a backup, then remove some old photos to free space, so new notes and photos can still be saved.'
  },

  lightbox: {
    label: 'Photos',
    /**
     * @param {number} n
     * @param {number} total
     */
    position: (n, total) => `Photo ${n} of ${total}`,
    previous: 'Previous photo',
    next: 'Next photo',
    useAsCover: 'Use as cover',
    isCover: 'Cover photo',
    coverChanged: 'Cover photo changed'
  },

  photos: {
    add: 'Add photos',
    remove: 'Remove photo',
    failed: 'This photo could not be read',
    /** @param {number} limit */
    tooMany: (limit) => `An entry holds up to ${limit} photos, so only the first ones were added.`
  },

  installHint: {
    title: 'Add Garden Journal to your Home Screen first, so your journal is kept safe',
    steps: 'Tap the Share button, choose Add to Home Screen, then open Garden Journal from your Home Screen.'
  },

  navigation: {
    toGardens: 'Go to your gardens',
    toGarden: 'Back to the garden'
  },

  gardenStatus: { active: 'Active', archived: 'Archived' },
  sun: { full: 'Full sun', part: 'Part shade', shade: 'Shade' },
  plantStatus: { growing: 'Growing', dormant: 'Dormant', removed: 'Removed', dead: 'Dead' },
  issueKind: {
    pest: 'Pest',
    disease: 'Disease',
    deficiency: 'Deficiency',
    damage: 'Damage',
    weather: 'Weather',
    other: 'Other'
  },
  severity: { low: 'Low', medium: 'Medium', high: 'High' },
  issueStatus: { open: 'Open', watching: 'Watching', resolved: 'Resolved' },
  entryKind: {
    observation: 'Observation',
    checked: 'Checked',
    watered: 'Watered',
    fed: 'Fed',
    pruned: 'Pruned',
    treated: 'Treated',
    planted: 'Planted',
    moved: 'Moved',
    harvested: 'Harvested',
    other: 'Other'
  },

  // What went wrong and what to do next. Every message names a way forward.
  errors: {
    field: {
      required: 'This needs filling in.',
      /** @param {number} limit */
      tooLong: (limit) => `This is too long. Keep it to ${limit.toLocaleString('en-GB')} characters or fewer.`,
      /** @param {number} limit */
      tooMany: (limit) => `You can add up to ${limit} photos at a time. Remove some and try again.`,
      invalid: 'This doesn’t look right. Check it and try again.',
      future: 'This date is in the future. Choose today or an earlier day.'
    },
    invalid: {
      title: 'Something needs changing',
      message: 'Check the highlighted field, then try again.'
    },
    notFound: {
      title: 'This is no longer here',
      message: 'It may have been deleted, perhaps in another tab. Go back to see what is there now.'
    },
    readOnly: {
      title: 'This entry can’t be changed',
      message: 'Garden Journal wrote it to record a change, so it stays as it is.'
    },
    quota: {
      title: 'Your device is out of space',
      message: 'Make a backup, then remove some old photos to free space, and try again.'
    },
    unavailable: {
      title: 'Garden Journal can’t save in this browser',
      message:
        'The browser is not letting the app store anything, which usually means private browsing. Open Garden Journal in a normal window, or from your Home Screen.'
    },
    closed: {
      title: 'Garden Journal was updated in another tab',
      message: 'Reload to carry on. Nothing you saved has been lost.'
    },
    blocked: {
      title: 'Close your other Garden Journal tabs',
      message: 'An update is waiting for Garden Journal to close in your other tabs or windows. Close them and it will carry on by itself.'
    },
    notBackup: {
      title: 'This isn’t a Garden Journal backup',
      message: 'Choose the zip file that Export made, named like garden-journal-2026-10-03.zip. Nothing has been changed.'
    },
    newerBackup: {
      title: 'This backup is from a newer Garden Journal',
      message: 'Reload while online to update the app, then import it again. Nothing has been changed.'
    },
    unknown: {
      title: 'Something went wrong',
      message: 'Try again. If it keeps happening, reload the app. The details are kept in Backup and settings.'
    }
  },

  // Notes on entries the app writes itself. They are saved with the entry.
  autoEntry: {
    /** @param {string} title */
    issueFlagged: (title) => `Problem flagged: ${title}`,
    issueStatus: { open: 'Marked as open', watching: 'Marked as watching', resolved: 'Marked as resolved' }
  }
};
