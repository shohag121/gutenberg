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
const EMPTY_LIST = [];

function findFirstValidSibling( positions, current, velocity ) {
	const iterate = velocity > 0 ? 1 : -1;
	let index = current + iterate;
	const currentPosition = positions[ current ];
	while ( positions[ index ] !== undefined ) {
		const position = positions[ index ];
		if (
			position.dragSibling &&
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
	const [ dragItem, setDragItem ] = useState( false );
	const [ target, setTarget ] = useState( false );
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
				flatList: draggingId
					? __unstableGetFlatList( draggingId )
					: EMPTY_LIST,
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

	useEffect( () => {
		if ( draggingId && flatList.length === 2 ) {
			setDragItem( flatList[ 1 ] );
		} else {
			setDragItem( false );
		}
	}, [ flatList, draggingId ] );

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
		const { listPosition } = dragItem;
		const list = flatList?.[ 0 ];
		const positions = [
			...list.slice( 0, listPosition ),
			dragItem,
			...list.slice( listPosition, list.length ),
		];
		const draggingUpPastBounds =
			listPosition > positions.length &&
			direction === UP &&
			translate > 0;
		const draggingDownPastBounds =
			listPosition === 0 && direction === DOWN && translate < 0;

		if ( draggingUpPastBounds || draggingDownPastBounds ) {
			// If we've dragged past all items with the first or last item, don't start checking for potential swaps
			// until we're near other items
			console.log( 'dragging past bounds...' );
			return;
		}

		if (
			( direction === DOWN && translate < 0 ) ||
			( direction === UP && translate > 0 )
		) {
			//We're skipping over multiple items, wait until user catches up to the new slot
			console.log( 'skipping over multiple items...' );
			return;
		}

		console.log( translate );
		if ( Math.abs( translate ) < ITEM_HEIGHT / 2 ) {
			//don't bother calculating anything if we haven't moved half a step.
			console.log( 'min threshold not reached...' );
			return;
		}

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
		// 	setTarget( {
		// 		clientId: targetPosition.clientId,
		// 		padding: direction === DOWN ? 'bottom' : 'top',
		// 	} );
		// 	//Sibling swap
		// 	lastTarget.current = {
		// 		clientId: dragItem.clientId,
		// 		originalParent: dragItem.parentId,
		// 		targetId: targetPosition.clientId,
		// 		targetIndex:
		// 			targetPosition.index + ( direction === DOWN ? 1 : -1 ),
		// 	};
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
						dragTargetBlock={ target }
						{ ...props }
					/>
				</ListViewContext.Provider>
			</TreeGrid>
		</>
	);
}
