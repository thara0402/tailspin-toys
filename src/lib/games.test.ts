import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getPaginatedGames,
    getAllGameIds,
    getGameById,
    getFilteredGames,
    getAllCategories,
    getAllPublishers,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    describe('getPaginatedGames', () => {
        it('returns the requested page in title order with metadata', async () => {
            await seedGames(db, 7);

            const result = await getPaginatedGames(db, 2, 3);

            expect(result.page).toBe(2);
            expect(result.pageSize).toBe(3);
            expect(result.total).toBe(7);
            expect(result.totalPages).toBe(3);
            expect(result.games.map((game) => game.title)).toEqual([
                'Game 04',
                'Game 05',
                'Game 06',
            ]);
        });

        it('clamps invalid pages and uses the default page size', async () => {
            await seedGames(db, 7);

            const result = await getPaginatedGames(db, 0, 0);

            expect(result.page).toBe(1);
            expect(result.pageSize).toBe(6);
            expect(result.games).toHaveLength(6);
        });

        it('returns an empty first page for an empty database', async () => {
            const result = await getPaginatedGames(db, 1, 6);

            expect(result).toMatchObject({ page: 1, total: 0, totalPages: 0, games: [] });
        });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });

    describe('getAllCategories', () => {
        it('returns categories sorted alphabetically by name', async () => {
            await db.insert(categories).values([
                { id: 1, name: 'Strategy', description: null },
                { id: 2, name: 'Action', description: null },
                { id: 3, name: 'Puzzle', description: null },
            ]);

            const result = await getAllCategories(db);

            expect(result).toHaveLength(3);
            expect(result.map((c) => c.name)).toEqual(['Action', 'Puzzle', 'Strategy']);
        });

        it('returns empty array when no categories exist', async () => {
            const result = await getAllCategories(db);
            expect(result).toEqual([]);
        });

        it('includes category id and name', async () => {
            await db.insert(categories).values({ id: 1, name: 'RPG', description: null });

            const result = await getAllCategories(db);

            expect(result[0]).toEqual({ id: 1, name: 'RPG' });
        });
    });

    describe('getAllPublishers', () => {
        it('returns publishers sorted alphabetically by name', async () => {
            await db.insert(publishers).values([
                { id: 1, name: 'Zephyr Studios', description: null },
                { id: 2, name: 'Acme Games', description: null },
                { id: 3, name: 'Pixel House', description: null },
            ]);

            const result = await getAllPublishers(db);

            expect(result).toHaveLength(3);
            expect(result.map((p) => p.name)).toEqual([
                'Acme Games',
                'Pixel House',
                'Zephyr Studios',
            ]);
        });

        it('returns empty array when no publishers exist', async () => {
            const result = await getAllPublishers(db);
            expect(result).toEqual([]);
        });

        it('includes publisher id and name', async () => {
            await db.insert(publishers).values({ id: 1, name: 'Studio XYZ', description: null });

            const result = await getAllPublishers(db);

            expect(result[0]).toEqual({ id: 1, name: 'Studio XYZ' });
        });
    });

    describe('getFilteredGames', () => {
        beforeEach(async () => {
            // Set up test data: 2 publishers, 3 categories, 4 games
            await db.insert(publishers).values([
                { id: 1, name: 'Publisher A', description: null },
                { id: 2, name: 'Publisher B', description: null },
            ]);

            await db.insert(categories).values([
                { id: 1, name: 'Action', description: null },
                { id: 2, name: 'Puzzle', description: null },
                { id: 3, name: 'RPG', description: null },
            ]);

            // Insert 4 games with varying category and publisher combinations
            await db.insert(games).values([
                {
                    id: 1,
                    title: 'Blast Quest',
                    description: 'An action game',
                    starRating: 4.5,
                    categoryId: 1,
                    publisherId: 1,
                },
                {
                    id: 2,
                    title: 'Puzzle Palace',
                    description: 'A puzzle game',
                    starRating: 4.0,
                    categoryId: 2,
                    publisherId: 1,
                },
                {
                    id: 3,
                    title: 'Quest Explorer',
                    description: 'An RPG',
                    starRating: 4.8,
                    categoryId: 3,
                    publisherId: 2,
                },
                {
                    id: 4,
                    title: 'Ancient Riddle',
                    description: 'Another puzzle game',
                    starRating: 4.2,
                    categoryId: 2,
                    publisherId: 2,
                },
            ]);
        });

        it('returns all games when no filters provided', async () => {
            const result = await getFilteredGames(db);

            expect(result).toHaveLength(4);
            const titles = result.map((g) => g.title);
            expect(titles).toEqual(['Ancient Riddle', 'Blast Quest', 'Puzzle Palace', 'Quest Explorer']);
        });

        it('returns games filtered by single category', async () => {
            const result = await getFilteredGames(db, [1]);

            expect(result).toHaveLength(1);
            expect(result[0].title).toBe('Blast Quest');
            expect(result[0].category?.id).toBe(1);
        });

        it('returns games filtered by multiple categories', async () => {
            const result = await getFilteredGames(db, [1, 2]);

            expect(result).toHaveLength(3);
            const titles = result.map((g) => g.title);
            expect(titles).toEqual(['Ancient Riddle', 'Blast Quest', 'Puzzle Palace']);
        });

        it('returns games filtered by publisher', async () => {
            const result = await getFilteredGames(db, undefined, 1);

            expect(result).toHaveLength(2);
            const titles = result.map((g) => g.title);
            expect(titles).toEqual(['Blast Quest', 'Puzzle Palace']);
        });

        it('returns games filtered by both category and publisher', async () => {
            const result = await getFilteredGames(db, [2], 1);

            expect(result).toHaveLength(1);
            expect(result[0].title).toBe('Puzzle Palace');
        });

        it('returns empty array when filters match no games', async () => {
            const result = await getFilteredGames(db, [1], 2);

            expect(result).toEqual([]);
        });

        it('returns results ordered by title regardless of filters', async () => {
            const result = await getFilteredGames(db, [2]);

            const titles = result.map((g) => g.title);
            expect(titles).toEqual(['Ancient Riddle', 'Puzzle Palace']);
        });

        it('includes full game data with category and publisher relationships', async () => {
            const result = await getFilteredGames(db, [3]);

            expect(result).toHaveLength(1);
            const game = result[0];
            expect(game.title).toBe('Quest Explorer');
            expect(game.category).toEqual({ id: 3, name: 'RPG' });
            expect(game.publisher).toEqual({ id: 2, name: 'Publisher B' });
            expect(game.starRating).toBe(4.8);
        });

        it('handles empty category array same as no filter', async () => {
            const resultWithEmpty = await getFilteredGames(db, []);
            const resultWithUndefined = await getFilteredGames(db);

            expect(resultWithEmpty).toHaveLength(4);
            expect(resultWithUndefined).toHaveLength(4);
            expect(resultWithEmpty.map((g) => g.id)).toEqual(resultWithUndefined.map((g) => g.id));
        });
    });
});
