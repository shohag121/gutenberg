/**
 * External dependencies
 */
import { isArray } from 'lodash';

/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';

export const getBlockPositionDescription = ( position, siblingCount, level ) =>
	sprintf(
		/* translators: 1: The numerical position of the block. 2: The total number of blocks. 3. The level of nesting for the block. */
		__( 'Block %1$d of %2$d, Level %3$d' ),
		position,
		siblingCount,
		level
	);

/**
 * Returns true if the client ID occurs within the block selection or multi-selection,
 * or false otherwise.
 *
 * @param {string}          clientId               Block client ID.
 * @param {string|string[]} selectedBlockClientIds Selected block client ID, or an array of multi-selected blocks client IDs.
 *
 * @return {boolean} Whether the block is in multi-selection set.
 */
export const isClientIdSelected = ( clientId, selectedBlockClientIds ) =>
	isArray( selectedBlockClientIds ) && selectedBlockClientIds.length
		? selectedBlockClientIds.indexOf( clientId ) !== -1
		: selectedBlockClientIds === clientId;

export function removeItemFromTree( tree, id, parentId = '' ) {
	const newTree = [];
	let removeParentId = '';
	for ( let index = 0; index < tree.length; index++ ) {
		const block = tree[ index ];
		if ( block.clientId !== id ) {
			if ( block.innerBlocks.length > 0 ) {
				const {
					newTree: innerBlocks,
					removeParentId: cRemoveParentId,
				} = removeItemFromTree( block.innerBlocks, id, block.clientId );
				newTree.push( {
					...block,
					innerBlocks,
				} );
				removeParentId =
					cRemoveParentId !== '' ? cRemoveParentId : removeParentId;
			} else {
				newTree.push( { ...block } );
			}
		} else {
			removeParentId = parentId;
		}
	}
	return { newTree, removeParentId };
}

export function addItemToTree(
	tree,
	id,
	item,
	insertAfter = true,
	parentId = ''
) {
	const newTree = [];
	let targetIndex = -1;
	let targetId = '';
	for ( let index = 0; index < tree.length; index++ ) {
		const block = tree[ index ];
		if ( block.clientId === id ) {
			targetId = parentId;
			if ( insertAfter ) {
				targetIndex = newTree.length + 1;
				newTree.push( { ...block } );
				newTree.push( { ...item } );
			} else {
				targetIndex = newTree.length;
				newTree.push( { ...item } );
				newTree.push( { ...block } );
			}
		} else if ( block.clientId !== id ) {
			if ( block.innerBlocks.length > 0 ) {
				const {
					newTree: innerBlocks,
					targetIndex: childTargetIndex,
					targetId: childTargetId,
				} = addItemToTree(
					block.innerBlocks,
					id,
					item,
					insertAfter,
					block.clientId
				);
				newTree.push( {
					...block,
					innerBlocks,
				} );
				targetIndex = Math.max( targetIndex, childTargetIndex );
				targetId = childTargetId !== '' ? childTargetId : targetId;
			} else {
				newTree.push( { ...block } );
			}
		}
	}
	return { newTree, targetId, targetIndex };
}

export function addChildItemToTree( tree, id, item ) {
	const newTree = [];
	for ( let index = 0; index < tree.length; index++ ) {
		const block = tree[ index ];
		if ( block.clientId === id ) {
			block.innerBlocks = [ item, ...block.innerBlocks ];
			newTree.push( block );
		} else if ( block.clientId !== id ) {
			if ( block.innerBlocks.length > 0 ) {
				newTree.push( {
					...block,
					innerBlocks: addChildItemToTree(
						block.innerBlocks,
						id,
						item
					),
				} );
			} else {
				newTree.push( { ...block } );
			}
		}
	}
	return newTree;
}

export function findFirstValidSibling( positions, current, velocity ) {
	const iterate = velocity > 0 ? 1 : -1;
	let index = current + iterate;
	const currentPosition = positions[ current ];
	while ( positions[ index ] !== undefined ) {
		const position = positions[ index ];
		if (
			position.dropSibling &&
			position.parentId === currentPosition.parentId
		) {
			return [ position, index ];
		}
		index += iterate;
	}
	return [ null, null ];
}
