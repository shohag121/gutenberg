/**
 * External dependencies
 */
import { clone } from 'lodash';

/**
 * WordPress dependencies
 */

import { useMergeRefs, useReducedMotion } from '@wordpress/compose';
import { __experimentalTreeGrid as TreeGrid } from '@wordpress/components';
import { useDispatch } from '@wordpress/data';
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

function removeItemFromTree( tree, id, parentId = '' ) {
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

function addItemToTree( tree, id, item, insertAfter = true, parentId = '' ) {
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

function addChildItemToTree( tree, id, item ) {
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
	const [ dropped, setDropped ] = useState( false );
	const { clientIdsTree, selectedClientIds } = useListViewClientIds(
		blocks,
		showOnlyCurrentHierarchy,
		__experimentalPersistentListViewFeatures,
		draggingId
	);
	const [ tree, setTree ] = useState( clientIdsTree );
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

	const elementRef = useRef();
	const timeoutRef = useRef();
	const treeGridRef = useMergeRefs( [ elementRef, timeoutRef ] );

	const isMounted = useRef( false );
	useEffect( () => {
		isMounted.current = true;
	}, [] );

	const expand = ( clientId ) => {
		if ( ! clientId ) {
			return;
		}
		setExpandedState( { type: 'expand', clientId } );
	};
	const collapse = ( clientId ) => {
		if ( ! clientId ) {
			return;
		}
		setExpandedState( { type: 'collapse', clientId } );
	};
	const expandRow = ( row ) => {
		expand( row?.dataset?.block );
	};
	const collapseRow = ( row ) => {
		collapse( row?.dataset?.block );
	};

	const animate = ! useReducedMotion();

	const positionsRef = useRef( {} );
	const positions = positionsRef.current;
	const setPosition = ( clientId, offset ) =>
		( positions[ clientId ] = offset );

	const lastTarget = useRef( null );
	useEffect( () => {
		lastTarget.current = null;
	}, [] );

	const dropItem = async () => {
		if ( ! lastTarget.current ) {
			return;
		}
		setDropped( true );
		const {
			clientId,
			originalParent,
			targetId,
			targetIndex,
		} = lastTarget.current;
		lastTarget.current = null;
		await moveBlocksToPosition(
			[ clientId ],
			originalParent,
			targetId,
			targetIndex
		);
		//TODO: still need to find something more reliable to test if things have settled
		timeoutRef.current = setTimeout( () => {
			setDropped( false );
		}, 200 );
	};

	const moveItem = ( {
		block,
		translate,
		translateX,
		listPosition,
		velocity,
	} ) => {
		//TODO: fix nested containers such as columns and default settings
		//TODO: empty container with appender doesn't add children properly
		//TODO: simplify state and code
		const { clientId } = block;
		const ITEM_HEIGHT = 36;
		const UPDATE_PARENT_THRESHOLD = 20;

		const v = velocity?.get() ?? 0;
		if ( v === 0 ) {
			return;
		}

		const direction = v > 0 ? DOWN : UP;

		const draggingUpPastBounds =
			positions[ listPosition + 1 ] === undefined &&
			direction === UP &&
			translate > 0;
		const draggingDownPastBounds =
			listPosition === 0 && direction === DOWN && translate < 0;

		if ( draggingUpPastBounds || draggingDownPastBounds ) {
			// If we've dragged past all items with the first or last item, don't start checking for potential swaps
			// until we're near other items
			return;
		}

		if (
			( direction === DOWN && translate < 0 ) ||
			( direction === UP && translate > 0 )
		) {
			//We're skipping over multiple items, wait until user catches up to the new slot
			return;
		}

		if ( Math.abs( translate ) < ITEM_HEIGHT / 2 ) {
			//don't bother calculating anything if we haven't moved half a step.
			return;
		}

		if ( Math.abs( translateX ) > UPDATE_PARENT_THRESHOLD ) {
			const steps = Math.ceil( Math.abs( translate / ITEM_HEIGHT ) );
			const nextIndex =
				direction === UP ? listPosition - steps : listPosition + steps;

			const targetPosition = positions[ nextIndex ];

			if ( ! targetPosition ) {
				return;
			}
			// If we move to the right or left as we drag, allow more freeform targeting
			// so we can find a new parent container
			if ( translateX < 0 ) {
				// Insert after an item
				if ( ! targetPosition.parentId || targetPosition.dropSibling ) {
					const {
						newTree: treeWithoutDragItem,
						removeParentId,
					} = removeItemFromTree( clientIdsTree, clientId );
					const { newTree, targetIndex, targetId } = addItemToTree(
						treeWithoutDragItem,
						targetPosition.clientId,
						block,
						direction === DOWN
					);
					lastTarget.current = {
						clientId,
						originalParent: removeParentId,
						targetId,
						targetIndex,
					};
					setTree( newTree );
					return;
				} else if ( targetPosition.dropContainer ) {
					// Otherwise try inserting to a new parent (usually a level up).
					const {
						newTree: treeWithoutDragItem,
						removeParentId,
					} = removeItemFromTree( clientIdsTree, clientId );
					const newTree = addChildItemToTree(
						treeWithoutDragItem,
						targetPosition.clientId,
						block
					);
					lastTarget.current = {
						clientId,
						originalParent: removeParentId,
						targetId: targetPosition.clientId,
						targetIndex: 0,
					};
					setTree( newTree );
					return;
				}
			} else if ( translateX > 0 ) {
				//When dragging right nest under a valid parent container
				if ( targetPosition.dropContainer ) {
					const {
						newTree: treeWithoutDragItem,
						removeParentId,
					} = removeItemFromTree( clientIdsTree, clientId );
					const newTree = addChildItemToTree(
						treeWithoutDragItem,
						targetPosition.clientId,
						block
					);
					lastTarget.current = {
						clientId,
						originalParent: removeParentId,
						targetId: targetPosition.clientId,
						targetIndex: 0,
					};
					setTree( newTree );
					return;
				}
			}
			return;
		}

		const [ targetPosition, nextIndex ] = findFirstValidSibling(
			positions,
			listPosition,
			v
		);

		if (
			targetPosition &&
			Math.abs( translate ) >
				( ITEM_HEIGHT * Math.abs( listPosition - nextIndex ) ) / 2
		) {
			//Sibling swap
			const {
				newTree: treeWithoutDragItem,
				removeParentId,
			} = removeItemFromTree( clientIdsTree, clientId );
			const { newTree, targetIndex, targetId } = addItemToTree(
				treeWithoutDragItem,
				targetPosition.clientId,
				block,
				direction === DOWN
			);
			lastTarget.current = {
				clientId,
				originalParent: removeParentId,
				targetId,
				targetIndex,
			};
			setTree( newTree );
		}
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

	//TODO: mouseover on items highlights blocks and triggers a render check on all branches
	//TODO: used in prototyping, polish this more
	useEffect( () => {
		if ( draggingId ) {
			setTree( clone( clientIdsTree ) );
		}
	}, [ draggingId ] );

	useEffect( () => {
		if ( timeoutRef.current ) {
			clearTimeout( timeoutRef.current );
		}
	}, [] );

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
						blocks={ draggingId || dropped ? tree : clientIdsTree }
						selectBlock={ selectEditorBlock }
						selectedBlockClientIds={ selectedClientIds }
						setPosition={ setPosition }
						moveItem={ moveItem }
						dropItem={ dropItem }
						{ ...props }
					/>
				</ListViewContext.Provider>
			</TreeGrid>
		</>
	);
}
