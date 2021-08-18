/**
 * WordPress dependencies
 */

import { useReducedMotion } from '@wordpress/compose';
import {
	__experimentalTreeGrid as TreeGrid,
	__unstableUseMotionValue as useMotionValue,
} from '@wordpress/components';
import { useDispatch, useSelect } from '@wordpress/data';
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useReducer,
	useState,
} from '@wordpress/element';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import ListViewBranch from './branch';
import { ListViewContext } from './context';
import useListViewClientIds from './use-list-view-client-ids';
import { store as blockEditorStore } from '../../store';

const noop = () => {};
const expanded = ( state, action ) => {
	switch ( action.type ) {
		case 'expand':
			return { ...state, ...{ [ action.clientId ]: true } };
		case 'collapse':
			return { ...state, ...{ [ action.clientId ]: false } };
		default:
			return state;
	}
};

const UP = 'up';
const DOWN = 'down';

function findFirstValidSibling( positions, current, velocity ) {
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

/**
 * Wrap `ListViewRows` with `TreeGrid`. ListViewRows is a
 * recursive component (it renders itself), so this ensures TreeGrid is only
 * present at the very top of the navigation grid.
 *
 * @param {Object}   props                                          Components props.
 * @param {Array}    props.blocks                                   Custom subset of block client IDs to be used
 *                                                                  instead of the default hierarchy.
 * @param {Function} props.onSelect                                 Block selection callback.
 * @param {boolean}  props.showNestedBlocks                         Flag to enable displaying nested blocks.
 * @param {boolean}  props.showOnlyCurrentHierarchy                 Flag to limit the list to the current hierarchy of
 *                                                                  blocks.
 * @param {boolean}  props.__experimentalFeatures                   Flag to enable experimental features.
 * @param {boolean}  props.__experimentalPersistentListViewFeatures Flag to enable features for the Persistent List
 *                                                                  View experiment.
 */
export default function ListView( {
	blocks,
	showOnlyCurrentHierarchy,
	onSelect = noop,
	__experimentalFeatures,
	__experimentalPersistentListViewFeatures,
	...props
} ) {
	const [ draggingId, setDraggingId ] = useState( false );
	const [ listPosition, setListPosition ] = useState( false );
	const { clientIdsTree, selectedClientIds } = useListViewClientIds(
		blocks,
		showOnlyCurrentHierarchy,
		__experimentalPersistentListViewFeatures,
		draggingId
	);
	const { flatList } = useSelect(
		( select ) => {
			const { __unstableGetFlatList } = select( blockEditorStore );

			return {
				flatList: draggingId ? __unstableGetFlatList( draggingId ) : [],
			};
		},
		[ draggingId ]
	);
	const { selectBlock, moveBlocksToPosition } = useDispatch(
		blockEditorStore
	);
	const selectEditorBlock = useCallback(
		( clientId ) => {
			selectBlock( clientId );
			onSelect( clientId );
		},
		[ selectBlock, onSelect ]
	);
	const [ expandedState, setExpandedState ] = useReducer( expanded, {} );

	const treeGridRef = useRef();

	const isMounted = useRef( false );
	useEffect( () => {
		isMounted.current = true;
	}, [] );

	const expand = useCallback(
		( clientId ) => {
			if ( ! clientId ) {
				return;
			}
			setExpandedState( { type: 'expand', clientId } );
		},
		[ setExpandedState ]
	);
	const collapse = useCallback(
		( clientId ) => {
			if ( ! clientId ) {
				return;
			}
			setExpandedState( { type: 'collapse', clientId } );
		},
		[ setExpandedState ]
	);
	const expandRow = useCallback(
		( row ) => {
			expand( row?.dataset?.block );
		},
		[ expand ]
	);
	const collapseRow = useCallback(
		( row ) => {
			collapse( row?.dataset?.block );
		},
		[ collapse ]
	);

	const animate = ! useReducedMotion();

	//avoid a react: re-render
	const lastTarget = useMotionValue( null );
	useEffect( () => {
		lastTarget.set( null );
	}, [] );

	const dropItem = () => {
		const target = lastTarget.get();
		if ( ! target ) {
			return;
		}
		const { clientId, originalParent, targetId, targetIndex } = target;
		lastTarget.set( null );
		moveBlocksToPosition(
			[ clientId ],
			originalParent,
			targetId,
			targetIndex
		);
	};
	const moveItem = ( { block, translate, translateX, velocity } ) => {
		//TODO: instead of modifying cloned tree in place, keep track of where drop item should be, and mark target
		//      to add 36px padding to make space instead
		const { clientId } = block;
		const ITEM_HEIGHT = 36;
		const LEFT_RIGHT_DRAG_THRESHOLD = 20;

		const v = velocity?.get() ?? 0;
		if ( v === 0 ) {
			return;
		}

		const direction = v > 0 ? DOWN : UP;

		// const draggingUpPastBounds =
		// 	positions[ listPosition + 1 ] === undefined &&
		// 	direction === UP &&
		// 	translate > 0;
		// const draggingDownPastBounds =
		// 	listPosition === 0 && direction === DOWN && translate < 0;
		//
		// if ( draggingUpPastBounds || draggingDownPastBounds ) {
		// 	// If we've dragged past all items with the first or last item, don't start checking for potential swaps
		// 	// until we're near other items
		// 	return;
		// }

		// if (
		// 	( direction === DOWN && translate < 0 ) ||
		// 	( direction === UP && translate > 0 )
		// ) {
		// 	//We're skipping over multiple items, wait until user catches up to the new slot
		// 	return;
		// }
		//
		// if ( Math.abs( translate ) < ITEM_HEIGHT / 2 ) {
		// 	//don't bother calculating anything if we haven't moved half a step.
		// 	return;
		// }
		//
		// if ( Math.abs( translateX ) > LEFT_RIGHT_DRAG_THRESHOLD ) {
		// 	const steps = Math.ceil( Math.abs( translate / ITEM_HEIGHT ) );
		// 	const nextIndex =
		// 		direction === UP ? listPosition - steps : listPosition + steps;
		//
		// 	const targetPosition = positions[ nextIndex ];
		//
		// 	if ( ! targetPosition ) {
		// 		return;
		// 	}
		// 	// If we move to the right or left as we drag, allow more freeform targeting
		// 	// so we can find a new parent container
		// 	if ( translateX < 0 ) {
		// 		// Insert after an item
		// 		if ( targetPosition.dropSibling ) {
		// 			// const {
		// 			// 	newTree: treeWithoutDragItem,
		// 			// 	removeParentId,
		// 			// } = removeItemFromTree( clientIdsTree, clientId );
		// 			// const { newTree, targetIndex, targetId } = addItemToTree(
		// 			// 	treeWithoutDragItem,
		// 			// 	targetPosition.clientId,
		// 			// 	block,
		// 			// 	direction === DOWN
		// 			// );
		// 			// lastTarget.set( {
		// 			// 	clientId,
		// 			// 	originalParent: removeParentId,
		// 			// 	targetId,
		// 			// 	targetIndex,
		// 			// } );
		// 			// setTree( newTree );
		// 			// return;
		// 		} else if ( targetPosition.dropContainer ) {
		// 			// Otherwise try inserting to a new parent (usually a level up).
		// 			// const {
		// 			// 	newTree: treeWithoutDragItem,
		// 			// 	removeParentId,
		// 			// } = removeItemFromTree( clientIdsTree, clientId );
		// 			// const newTree = addChildItemToTree(
		// 			// 	treeWithoutDragItem,
		// 			// 	targetPosition.clientId,
		// 			// 	block
		// 			// );
		// 			// lastTarget.set( {
		// 			// 	clientId,
		// 			// 	originalParent: removeParentId,
		// 			// 	targetId: targetPosition.clientId,
		// 			// 	targetIndex: 0,
		// 			// } );
		// 			// setTree( newTree );
		// 			return;
		// 		}
		// 	} else if ( translateX > 0 ) {
		// 		//When dragging right nest under a valid parent container
		// 		// if ( targetPosition.dropContainer ) {
		// 		// 	const {
		// 		// 		newTree: treeWithoutDragItem,
		// 		// 		removeParentId,
		// 		// 	} = removeItemFromTree( clientIdsTree, clientId );
		// 		// 	const newTree = addChildItemToTree(
		// 		// 		treeWithoutDragItem,
		// 		// 		targetPosition.clientId,
		// 		// 		block
		// 		// 	);
		// 		// 	lastTarget.set( {
		// 		// 		clientId,
		// 		// 		originalParent: removeParentId,
		// 		// 		targetId: targetPosition.clientId,
		// 		// 		targetIndex: 0,
		// 		// 	} );
		// 		// 	setTree( newTree );
		// 		// 	return;
		// 		// }
		// 	}
		// 	return;
		// }
		//
		// const [ targetPosition, nextIndex ] = findFirstValidSibling(
		// 	positions,
		// 	listPosition,
		// 	v
		// );
		//
		// if (
		// 	targetPosition &&
		// 	Math.abs( translate ) >
		// 		( ITEM_HEIGHT * Math.abs( listPosition - nextIndex ) ) / 2
		// ) {
		//
		// 	console.log({ targetPosition } );
		// 	//Sibling swap
		// 	// const {
		// 	// 	newTree: treeWithoutDragItem,
		// 	// 	removeParentId,
		// 	// } = removeItemFromTree( clientIdsTree, clientId );
		// 	// const { newTree, targetIndex, targetId } = addItemToTree(
		// 	// 	treeWithoutDragItem,
		// 	// 	targetPosition.clientId,
		// 	// 	block,
		// 	// 	direction === DOWN
		// 	// );
		// 	// lastTarget.current = {
		// 	// 	clientId,
		// 	// 	originalParent: removeParentId,
		// 	// 	targetId,
		// 	// 	targetIndex,
		// 	// };
		// 	// setTree( newTree );
		// }
	};

	const contextValue = useMemo(
		() => ( {
			__experimentalFeatures,
			__experimentalPersistentListViewFeatures,
			isTreeGridMounted: isMounted.current,
			expandedState,
			expand,
			collapse,
			animate,
			draggingId,
			setDraggingId,
		} ),
		[
			__experimentalFeatures,
			__experimentalPersistentListViewFeatures,
			isMounted.current,
			expandedState,
			expand,
			collapse,
			animate,
			draggingId,
			setDraggingId,
		]
	);

	return (
		<>
			<TreeGrid
				className="block-editor-list-view-tree"
				aria-label={ __( 'Block navigation structure' ) }
				ref={ treeGridRef }
				onCollapseRow={ collapseRow }
				onExpandRow={ expandRow }
				animate={ animate }
			>
				<ListViewContext.Provider value={ contextValue }>
					<ListViewBranch
						blocks={ clientIdsTree }
						selectBlock={ selectEditorBlock }
						selectedBlockClientIds={ selectedClientIds }
						moveItem={ moveItem }
						dropItem={ dropItem }
						setListPosition={ setListPosition }
						{ ...props }
					/>
				</ListViewContext.Provider>
			</TreeGrid>
		</>
	);
}
