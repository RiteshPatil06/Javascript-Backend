class APIResponse {
    constructor(statuscode, data, message = "success", errors) {
        this.statuscode = statuscode;
        this.data = data;
        this.message = message;
        this.success = statuscode < 400 ;
        this.errors = errors;
    }
}

export {APIResponse}