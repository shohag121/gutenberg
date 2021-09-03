/**
 * External dependencies
 */
import MicroModal from 'micromodal';

function navigationToggleModal( modal ) {
	const triggerButton = document.querySelector(
		`button[data-micromodal-trigger="${ modal.id }"]`
	);
	const closeButton = modal.querySelector( 'button[data-micromodal-close]' );
	// Use aria-hidden to determine the status of the modal, as this attribute is
	// managed by micromodal.
	const isHidden = 'true' === modal.getAttribute( 'aria-hidden' );
	triggerButton.setAttribute( 'aria-expanded', ! isHidden );
	closeButton.setAttribute( 'aria-expanded', ! isHidden );
	modal.classList.toggle( 'has-modal-open', ! isHidden );

	// Add a class to indicate the modal is open.
	const htmlElement = document.documentElement;
	htmlElement.classList.toggle( 'has-modal-open' );
}

// Necessary for some themes such as TT1 Blocks, where
// scripts could be loaded before the body.
window.onload = () =>
	MicroModal.init( {
		onShow: navigationToggleModal,
		onClose: navigationToggleModal,
		openClass: 'is-menu-open',
	} );
