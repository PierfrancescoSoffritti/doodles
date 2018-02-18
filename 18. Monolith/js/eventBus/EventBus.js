function EventBus() {
    const eventObjects = new Array();
    
    this.subscribe = function(eventType, callback) {
        const eventObject = findEventObject(eventType)

        if(eventObject)
            eventObject.callbacks.push(callback);
        else
            eventObjects.push( new EventObject(eventType, callback) );
    }

    this.post = function(eventType, argument1, argument2) {
        const eventObject = findEventObject(eventType)
        
        if(!eventObject) {
            console.error("no subscribers for event " +eventType)
            return;
        }

        eventObject.callbacks.forEach( callback => callback(argument1, argument2) );
    }

    function findEventObject(eventType) {
        return eventObjects.find( eventObject => eventObject.eventType === eventType );
    }

    function EventObject(type, callback) {
        this.eventType = type;
        this.callbacks = new Array(callback);
    }
}