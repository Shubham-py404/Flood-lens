import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthenticatedUserId } from '@/lib/auth';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function DELETE(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;

        if (!id || !UUID_REGEX.test(id)) {
            return NextResponse.json({ error: 'Invalid UUID identifier' }, { status: 400 });
        }

        const userId = getAuthenticatedUserId(request);

        const result = await query(
            'DELETE FROM saved_locations WHERE id = $1 AND user_id = $2 RETURNING id',
            [id, userId]
        );

        if (result.rowCount === 0) {
            return NextResponse.json(
                { error: 'Saved location not found or unauthorized' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Saved location removed successfully',
            id,
        });
    } catch (error) {
        console.error('Failed to delete saved location:', error);
        return NextResponse.json(
            { error: 'Internal server error deleting saved location' },
            { status: 500 }
        );
    }
}
