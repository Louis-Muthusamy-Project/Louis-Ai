class Planner {

    async createPlan(message) {

        return {

            goal: message,

            steps: [

                {

                    type: "chat"

                }

            ]

        };

    }

}

module.exports = new Planner();