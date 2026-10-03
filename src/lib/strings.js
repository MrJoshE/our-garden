// Every piece of user-facing text lives here.

/** Sorts names the way a person would: ignoring case and accents, with 2 before 10 */
export const compareText = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true }).compare;

export const strings = {
  appName: 'Garden Journal',
  other: 'Other',

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
