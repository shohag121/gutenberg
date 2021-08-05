/**
 * WordPress dependencies
 */
import {
	createNewPost,
	insertBlock,
	pressKeyWithModifier,
	getAllBlocks,
} from '@wordpress/e2e-test-utils';

async function dragAndDrop( draggableElement, targetElement, offsetY ) {
	const draggablePoint = await draggableElement.clickablePoint();
	const targetClickablePoint = await targetElement.clickablePoint();
	const targetPoint = {
		x: targetClickablePoint.x,
		y: targetClickablePoint.y + offsetY,
	};

	return await page.mouse.dragAndDrop( draggablePoint, targetPoint );
}

describe( 'List view', () => {
	beforeAll( async () => {
		await page.setDragInterception( true );
	} );

	beforeEach( async () => {
		await createNewPost();
	} );

	afterAll( async () => {
		await page.setDragInterception( false );
	} );

	//TODO: drag and drop is not slow enough to trigger correct events, possibly need to script this
	it.skip( 'allows a user to drag a block to a new sibling position', async () => {
		// Insert some blocks of different types.
		await insertBlock( 'Heading' );
		await insertBlock( 'Image' );
		await insertBlock( 'Paragraph' );

		// Open list view.
		await pressKeyWithModifier( 'access', 'o' );

		const blocks = await getAllBlocks();

		expect( blocks.length ).toEqual( 3 );

		const paragraphBlock = await page.waitForSelector(
			`#list-view-block-${ blocks[ 2 ].clientId }`
		);

		// Drag above the heading block
		const headingBlock = await page.waitForSelector(
			`#list-view-block-${ blocks[ 0 ].clientId }`
		);

		const reorderedBlocks = await getAllBlocks();

		dragAndDrop( paragraphBlock, headingBlock, -5 );

		expect( reorderedBlocks[ 0 ] ).toEqual( blocks[ 2 ] );
		expect( reorderedBlocks[ 1 ] ).toEqual( blocks[ 1 ] );
		expect( reorderedBlocks[ 2 ] ).toEqual( blocks[ 0 ] );
	} );
} );
