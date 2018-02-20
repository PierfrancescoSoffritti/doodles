function startGame() {
    const htmlContainer = document.getElementById("htmlContainer")
    const disablingDiv = document.getElementById("disablingDiv")

	const instructionsContainer = document.getElementById("instructionsContainer")
	instructionsContainer.classList.add("fade")

	const countDownContainer = document.getElementById("countDownContainer")
	countDownContainer.classList.remove("fade")

    sceneManager.introScreenClosed()
    disablingDiv.style.display = 'block'

	startTimeOut()
}

function startTimeOut() {
	setTimeout( () => countDownContainer.innerText = "3", 1000)
	setTimeout( () => countDownContainer.innerText = "2", 2000)
	setTimeout( () => countDownContainer.innerText = "1", 3000)

	setTimeout( () => { 
		countDownContainer.innerText = "0"
		eventBus.post(startCountDownFinishedEvent)
	}, 4000)

	setTimeout( () => {
        countDownContainer.innerText = ""
        countDownContainer.classList.add("fade")
	}, 4500)
}

function gameOver() {
    disablingDiv.style.display = 'none'
    instructionsContainer.classList.remove("fade")
}

eventBus.subscribe(gameOverEvent, gameOver)