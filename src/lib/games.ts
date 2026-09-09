import { eq, asc, inArray, and, count } from 'drizzle-orm';
import type { Database } from './db';
import { games, categories, publishers } from '../../db/schema';
import type { Game, Category, Publisher } from '../types/game';

const gameSelection = {
    id: games.id,
    title: games.title,
    description: games.description,
    starRating: games.starRating,
    categoryId: categories.id,
    categoryName: categories.name,
    publisherId: publishers.id,
    publisherName: publishers.name,
};

type GameSelectionRow = {
    id: number;
    title: string;
    description: string;
    starRating: number | null;
    categoryId: number | null;
    categoryName: string | null;
    publisherId: number | null;
    publisherName: string | null;
};

export interface PaginatedGames {
    games: Game[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
}

function mapGame(row: GameSelectionRow): Game {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        starRating: row.starRating,
        category:
            row.categoryId !== null && row.categoryName !== null
                ? { id: row.categoryId, name: row.categoryName }
                : null,
        publisher:
            row.publisherId !== null && row.publisherName !== null
                ? { id: row.publisherId, name: row.publisherName }
                : null,
    };
}

function baseGamesQuery(db: Database) {
    return db
        .select(gameSelection)
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id));
}

/**
 * Returns every game in a deterministic title order for the storefront and detail pages.
 *
 * @param db - The injectable database connection used for the page query.
 * @returns The mapped game records sorted by title.
 */
export async function getAllGames(db: Database): Promise<Game[]> {
    const rows = await baseGamesQuery(db).orderBy(asc(games.title));
    return rows.map(mapGame);
}

/**
 * Returns one deterministic page of games and the metadata needed to render pagination.
 *
 * @param db - The injectable database connection used for the query.
 * @param page - The one-based page number to return; values below one use page one.
 * @param pageSize - The number of games per page; values below one use the default of six.
 * @returns The page of mapped games and its total result metadata.
 */
export async function getPaginatedGames(
    db: Database,
    page: number = 1,
    pageSize: number = 6
): Promise<PaginatedGames> {
    const normalizedPageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : 6;
    const normalizedPage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const [{ total }] = await db.select({ total: count() }).from(games);
    const totalPages = Math.ceil(total / normalizedPageSize);
    const currentPage = totalPages === 0 ? 1 : Math.min(normalizedPage, totalPages);
    const rows = await baseGamesQuery(db)
        .orderBy(asc(games.title))
        .limit(normalizedPageSize)
        .offset((currentPage - 1) * normalizedPageSize);

    return {
        games: rows.map(mapGame),
        page: currentPage,
        pageSize: normalizedPageSize,
        total,
        totalPages,
    };
}

/**
 * Lists the stable identifiers for every game in title order.
 *
 * @param db - The injected database connection used for the lookup.
 * @returns The game ids sorted by title for static route generation.
 */
export async function getAllGameIds(db: Database): Promise<number[]> {
    const rows = await db.select({ id: games.id }).from(games).orderBy(asc(games.title));
    return rows.map((row) => row.id);
}

/**
 * Reads one game record by id, or returns null when the title is not present.
 *
 * @param db - The injected database connection for the lookup.
 * @param id - The game id to resolve.
 * @returns The mapped game, or null when no matching row exists.
 */
export async function getGameById(db: Database, id: number): Promise<Game | null> {
    const row = await baseGamesQuery(db).where(eq(games.id, id)).get();
    return row ? mapGame(row) : null;
}

/**
 * Returns all games filtered by optional category IDs and publisher ID, ordered by title.
 * Either or both filters can be applied; if neither is provided, returns all games.
 *
 * @param db - The injectable database connection.
 * @param categoryIds - Optional array of category IDs to filter by. Games matching any category are included.
 * @param publisherId - Optional publisher ID to filter by.
 * @returns Games matching the filter criteria, sorted by title.
 */
export async function getFilteredGames(
    db: Database,
    categoryIds?: number[],
    publisherId?: number
): Promise<Game[]> {
    const query = db
        .select(gameSelection)
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id));

    // Apply filters based on what's provided
    let rows;
    if (categoryIds && categoryIds.length > 0 && publisherId !== undefined) {
        rows = await query
            .where(and(inArray(games.categoryId, categoryIds), eq(games.publisherId, publisherId)))
            .orderBy(asc(games.title));
    } else if (categoryIds && categoryIds.length > 0) {
        rows = await query.where(inArray(games.categoryId, categoryIds)).orderBy(asc(games.title));
    } else if (publisherId !== undefined) {
        rows = await query.where(eq(games.publisherId, publisherId)).orderBy(asc(games.title));
    } else {
        rows = await query.orderBy(asc(games.title));
    }

    return rows.map(mapGame);
}

/**
 * Returns all categories in alphabetical order by name.
 *
 * @param db - The injectable database connection.
 * @returns All categories sorted alphabetically by name.
 */
export async function getAllCategories(db: Database): Promise<Category[]> {
    const rows = await db.select().from(categories).orderBy(asc(categories.name));
    return rows.map((row) => ({
        id: row.id,
        name: row.name,
    }));
}

/**
 * Returns all publishers in alphabetical order by name.
 *
 * @param db - The injectable database connection.
 * @returns All publishers sorted alphabetically by name.
 */
export async function getAllPublishers(db: Database): Promise<Publisher[]> {
    const rows = await db.select().from(publishers).orderBy(asc(publishers.name));
    return rows.map((row) => ({
        id: row.id,
        name: row.name,
    }));
}
