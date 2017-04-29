const actionAvailable = "actionAvailable";
const actionUnavailable = "actionUnavailable";

function ViewFinderManager() {
	const growAnimation = document.getElementById("pointerGrow");
	const shrinkAnimation = document.getElementById("pointerShrink");

	let isPointerBig = false;

	eventBus.subscribe(actionAvailable, onActionAvailable)
	eventBus.subscribe(actionUnavailable, onActionUnavailable)

	function onActionAvailable() {
		try {
			if(!isPointerBig)
				growAnimation.beginElement();

			isPointerBig = true;
		} catch(error) {
			console.error(error)
		}
	}

	function onActionUnavailable() {
		try {
			if(isPointerBig)
				shrinkAnimation.beginElement();

			isPointerBig = false;
		} catch(error) {
			console.error(error)
		}
	}
}