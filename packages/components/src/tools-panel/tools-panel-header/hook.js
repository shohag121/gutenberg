/**
 * WordPress dependencies
 */
import { useMemo } from '@wordpress/element';

/**
 * Internal dependencies
 */
import * as styles from '../styles';
import { useToolsPanelContext } from '../context';
import { useContextSystem } from '../../ui/context';
import { useCx } from '../../utils/hooks/use-cx';

export function useToolsPanelHeader( props ) {
	const { className, ...otherProps } = useContextSystem(
		props,
		'ToolsPanelHeader'
	);

	const cx = useCx();
	const classes = useMemo( () => {
		return cx( styles.ToolsPanelHeader, className );
	}, [ className ] );

	const { menuItems } = useToolsPanelContext();
	const menuItemsArray = Object.entries( menuItems );
	const hasMenuItems = !! menuItemsArray.length;
	const hasSelectedMenuItems = menuItemsArray.some( ( [ , isSelected ] ) => isSelected );

	return {
		...otherProps,
		hasMenuItems,
		hasSelectedMenuItems,
		menuItems,
		className: classes,
	};
}
