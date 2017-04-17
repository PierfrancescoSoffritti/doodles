const actionAvailable = "actionAvailable";
const actionUnavailable = "actionUnavailable";

function ViewFinderManager() {
	const growAnimation = document.getElementById("pointerGrow");
	const shrinkAnimation = document.getElementById("pointerShrink");

	let isPointerBig = false;

	eventBus.subscribe(actionAvailable, onActionAvailable)
	eventBus.subscribe(actionUnavailable, onActionUnavailable)

	function onActionAvailable() {
		if(!isPointerBig)
			growAnimation.beginElement();

		isPointerBig = true;
	}

	function onActionUnavailable() {
		if(isPointerBig)
			shrinkAnimation.beginElement();

		isPointerBig = false;
	}
}