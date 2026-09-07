import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  primaryKey,
  real,
  uniqueIndex,
  index,
  jsonb,
} from "drizzle-orm/pg-core";

export type SrsExampleHint = {
  text: string;
  highlights?: string[];
};

export type RubyPart = {
  base: string;
  reading?: string;
};

export type TargetChunk = {
  type: "text" | "hidden";
  text: string;
  reading?: string;
  ruby?: RubyPart[];
  script?: "kanji" | "hiragana" | "katakana";
};

export type LinkedToken = {
  start: number;
  end: number;
  surface: string;
  wordId: number;
  lemma?: string;
};

export type SrsExample = {
  order: number;
  sentence: string;
  hiddenWord: string;
  hiddenReading?: string;
  hiddenScript?: "kanji" | "hiragana" | "katakana";
  targetChunks?: TargetChunk[];
  linkedTokens?: LinkedToken[];
  hints: SrsExampleHint[];
};

export const userRoles = ["admin", "moderator", "user"] as const;
export type UserRole = (typeof userRoles)[number];

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("user"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sessionsTable = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const passwordResetTokensTable = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const wordsTable = pgTable("words", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, {
    onDelete: "cascade",
  }),
  kanji: text("kanji").notNull(),
  pronunciation: text("pronunciation").notNull().default(""),
  meaning: text("meaning").notNull().default(""),
  description: text("description").notNull().default(""),
  srsExamples: jsonb("srs_examples")
    .$type<SrsExample[]>()
    .notNull()
    .default([]),
  level: integer("level").notNull().default(1),
  starred: boolean("starred").notNull().default(false),
  pronLevel: integer("pron_level").notNull().default(1),
  pronStarred: boolean("pron_starred").notNull().default(false),
  meaningLevel: integer("meaning_level").notNull().default(1),
  meaningStarred: boolean("meaning_starred").notNull().default(false),
  jlptLevel: text("jlpt_level"),
  date: text("date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const wordRelationsTable = pgTable(
  "word_relations",
  {
    wordId: integer("word_id")
      .notNull()
      .references(() => wordsTable.id, { onDelete: "cascade" }),
    relatedWordId: integer("related_word_id")
      .notNull()
      .references(() => wordsTable.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.wordId, t.relatedWordId] })],
);

export const srsDeckTypes = [
  "word",
  "pronunciation",
  "meaning",
  "example",
  "drawing",
] as const;
export type SrsDeckType = (typeof srsDeckTypes)[number];

export const srsCardsTable = pgTable(
  "srs_cards",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    wordId: integer("word_id")
      .notNull()
      .references(() => wordsTable.id, { onDelete: "cascade" }),
    deckType: text("deck_type").notNull(),
    due: timestamp("due", { withTimezone: true }).notNull(),
    stability: real("stability").notNull().default(0),
    difficulty: real("difficulty").notNull().default(0),
    elapsedDays: integer("elapsed_days").notNull().default(0),
    scheduledDays: integer("scheduled_days").notNull().default(0),
    reps: integer("reps").notNull().default(0),
    lapses: integer("lapses").notNull().default(0),
    learningSteps: integer("learning_steps").notNull().default(0),
    state: integer("state").notNull().default(0),
    lastReview: timestamp("last_review", { withTimezone: true }),
    exampleCursor: integer("example_cursor").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("srs_cards_user_word_deck_idx").on(
      t.userId,
      t.wordId,
      t.deckType,
    ),
  ],
);

export const wordMistakesTable = pgTable(
  "word_mistakes",
  {
    wordId: integer("word_id")
      .notNull()
      .references(() => wordsTable.id, { onDelete: "cascade" }),
    deckType: text("deck_type").notNull(),
    mistakeCount: integer("mistake_count").notNull().default(1),
    lastMistakeAt: timestamp("last_mistake_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.wordId, t.deckType] })],
);

export type ThemeQuizChoice = {
  key: string;
  label: string;
};

export const themeQuizQuestionTypes = ["ab", "four"] as const;
export type ThemeQuizQuestionType = (typeof themeQuizQuestionTypes)[number];

export const themesTable = pgTable("themes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  iconSvg: text("icon_svg"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const themeWordsTable = pgTable(
  "theme_words",
  {
    themeId: integer("theme_id")
      .notNull()
      .references(() => themesTable.id, { onDelete: "cascade" }),
    wordId: integer("word_id")
      .notNull()
      .references(() => wordsTable.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.themeId, t.wordId] })],
);

export const themeQuizQuestionsTable = pgTable("theme_quiz_questions", {
  id: serial("id").primaryKey(),
  themeId: integer("theme_id")
    .notNull()
    .references(() => themesTable.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").notNull().default(0),
  type: text("type").notNull(),
  prompt: text("prompt").notNull().default(""),
  choices: jsonb("choices")
    .$type<ThemeQuizChoice[]>()
    .notNull()
    .default([]),
  correctKey: text("correct_key").notNull().default(""),
  hints: jsonb("hints")
    .$type<SrsExampleHint[]>()
    .notNull()
    .default([]),
});

/** Per-day SRS study counts by deck (local calendar date YYYY-MM-DD). */
export const studyActivityTable = pgTable(
  "study_activity",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    deckType: text("deck_type").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.date, t.deckType] }),
  ],
);

/** Per-review log for listing words studied on a given calendar day. */
export const srsReviewLogTable = pgTable(
  "srs_review_log",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    wordId: integer("word_id")
      .notNull()
      .references(() => wordsTable.id, { onDelete: "cascade" }),
    deckType: text("deck_type").notNull(),
    /** Local calendar date YYYY-MM-DD when the review occurred. */
    date: text("date").notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("srs_review_log_user_deck_date_idx").on(
      t.userId,
      t.deckType,
      t.date,
    ),
  ],
);

export const categoriesTable = pgTable("categories", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  iconSvg: text("icon_svg"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const categoryWordsTable = pgTable(
  "category_words",
  {
    categoryId: integer("category_id")
      .notNull()
      .references(() => categoriesTable.id, { onDelete: "cascade" }),
    wordId: integer("word_id")
      .notNull()
      .references(() => wordsTable.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.categoryId, t.wordId] })],
);

/** Per-list pinned words (scope matches client list keys, e.g. /words, meaning). */
export const pinnedWordsTable = pgTable(
  "pinned_words",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    scope: text("scope").notNull(),
    wordId: integer("word_id")
      .notNull()
      .references(() => wordsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.scope, t.wordId] })],
);
