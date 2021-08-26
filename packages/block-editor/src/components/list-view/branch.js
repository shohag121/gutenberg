/**
 * External dependencies
 */
import { map, compact } from 'lodash';

/**
 * WordPress dependencies
 */
import { Fragment } from '@wordpress/element';

/**
 * Internal dependencies
 */
import ListViewBlock from './block';
import ListViewAppender from './appender';
import { isClientIdSelected } from './utils';
import { useListViewContext } from './context';

function countBlocks( block, expandedState ) {
	const isExpanded = expandedState[ block.clientId ] ?? true;
	if ( isExpanded ) {
		return 1 + block.innerBlocks.reduce( countReducer( expandedState ), 0 );
	}
	return 1;
}
const countReducer = ( expandedState ) => ( count, block ) => {
	const isExpanded = expandedState[ block.clientId ] ?? true;
	if ( isExpanded && block.innerBlocks.length > 0 ) {
		return count + countBlocks( block, expandedState );
	}
	return count + 1;
};

export default function ListViewBranch( props ) {
	const {
		blocks,
		selectBlock,
		selectedBlockClientIds,
		showAppender,
		showBlockMovers,
		showNestedBlocks,
		parentBlockClientId,
		level = 1,
		terminatedLevels = [],
		animateToggleOpen = false,
		setPosition,
		moveItem,
		listPosition = 0,
		draggingId,
		dragStart,
		dragEnd,
	} = props;

	const isTreeRoot = ! parentBlockClientId;
	const filteredBlocks = compact( blocks );
	const itemHasAppender = ( parentClientId ) =>
		showAppender &&
		! isTreeRoot &&
		isClientIdSelected( parentClientId, selectedBlockClientIds );
	const hasAppender = itemHasAppender( parentBlockClientId );
	// Add +1 to the rowCount to take the block appender into account.
	const blockCount = filteredBlocks.length;
	const rowCount = hasAppender ? blockCount + 1 : blockCount;
	const appenderPosition = rowCount;

	const {
		expandedState,
		expand,
		collapse,
		isTreeGridMounted,
		useAnimation,
	} = useListViewContext();

	let nextPosition = listPosition;

	return (
		<>
			{ map( filteredBlocks, ( block, index ) => {
				const { clientId, innerBlocks } = block;
				const position = index + 1;
				const isLastRowAtLevel = rowCount === position;
				const updatedTerminatedLevels = isLastRowAtLevel
					? [ ...terminatedLevels, level ]
					: terminatedLevels;
				const hasNestedBlocks =
					showNestedBlocks && !! innerBlocks && !! innerBlocks.length;
				const hasNestedAppender = itemHasAppender( clientId );
				const hasNestedBranch = hasNestedBlocks || hasNestedAppender;

				const isSelected = isClientIdSelected(
					clientId,
					selectedBlockClientIds
				);
				const isExpanded = hasNestedBranch
					? expandedState[ clientId ] ?? true
					: undefined;

				const selectBlockWithClientId = ( event ) => {
					event.stopPropagation();
					selectBlock( clientId );
				};

				const toggleExpanded = ( event ) => {
					event.stopPropagation();
					if ( isExpanded === true ) {
						collapse( clientId );
					} else if ( isExpanded === false ) {
						expand( clientId );
					}
				};

				const animateToggle =
					useAnimation &&
					( animateToggleOpen ||
						( isExpanded &&
							isTreeGridMounted &&
							expandedState[ clientId ] !== undefined ) );
				if ( index > 0 ) {
					nextPosition += countBlocks(
						filteredBlocks[ index - 1 ],
						expandedState
					);
				}
				return (
					<Fragment key={ clientId }>
						<ListViewBlock
							block={ block }
							onClick={ selectBlockWithClientId }
							onToggleExpanded={ toggleExpanded }
							isSelected={ isSelected }
							level={ level }
							position={ position }
							rowCount={ rowCount }
							siblingBlockCount={ blockCount }
							showBlockMovers={ showBlockMovers }
							isExpanded={ isExpanded }
							animateToggleOpen={ animateToggle }
							setPosition={ setPosition }
							moveItem={ moveItem }
							listPosition={ nextPosition }
							parentId={ parentBlockClientId }
							draggingId={ draggingId }
							dragStart={ () => dragStart( clientId ) }
							dragEnd={ () => dragEnd( clientId ) }
						/>
						{ hasNestedBranch && isExpanded && (
							<ListViewBranch
								blocks={ innerBlocks }
								selectedBlockClientIds={
									selectedBlockClientIds
								}
								selectBlock={ selectBlock }
								showAppender={ showAppender }
								showBlockMovers={ showBlockMovers }
								showNestedBlocks={ showNestedBlocks }
								parentBlockClientId={ clientId }
								level={ level + 1 }
								terminatedLevels={ updatedTerminatedLevels }
								animateToggleOpen={ animateToggle }
								setPosition={ setPosition }
								moveItem={ moveItem }
								listPosition={ nextPosition + 1 }
								draggingId={ draggingId }
								dragStart={ dragStart }
								dragEnd={ dragEnd }
							/>
						) }
					</Fragment>
				);
			} ) }
			{ hasAppender && (
				<ListViewAppender
					parentBlockClientId={ parentBlockClientId }
					position={ rowCount }
					rowCount={ appenderPosition }
					level={ level }
					terminatedLevels={ terminatedLevels }
				/>
			) }
		</>
	);
}

ListViewBranch.defaultProps = {
	selectBlock: () => {},
};
