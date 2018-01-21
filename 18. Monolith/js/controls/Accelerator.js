function Accelerator(speed, acceletationMax, accelerationIncreaseStep, accelerationDecreaseStep) {
    
    let acceleration = 0
    let prevDirection = 0

    this.getForce = function(direction) {
        updateAngleAcceleration(direction)
        prevDirection = direction

        return speed * acceleration
    }

    function updateAngleAcceleration(direction) {
        if(direction === 0)
            decelerate()            
        else        
            accelerate(direction)
        
        function decelerate() {
            if(Math.abs(acceleration) !== 0)
                acceleration = Math.sign(acceleration) * ( Math.abs(acceleration) - accelerationDecreaseStep )
            if(Math.abs(acceleration) < 0.01)
                acceleration = 0

            return 0
        }

        function accelerate(direction) {            
            if( prevDirection != direction )
                decelerate()

            if(Math.abs(acceleration) < acceletationMax)
                acceleration += direction * accelerationIncreaseStep
            else
                acceleration = direction * acceletationMax

            return direction
        }
    }
}