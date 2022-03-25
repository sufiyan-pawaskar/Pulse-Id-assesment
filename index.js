const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const moment = require('moment');
const port = 3000;

var app = express();

// DB variable is acting as an in membort database
var db = {
    transaction:[],
    ruleSet:[],
    cashback:[]
}

// models represent all the functionality related to database
const models = {
    /**
    * Save a ruleset and returns it.
    *
    * @param {object} ruleSet The ruleset to be saved.
    * @return {object} Saved ruleset.
    */
    addRuleSet : async (ruleSet)=>{
        let ruleSetWithId = {
            id:`RS-${moment().toDate().getTime()}`,
            ...ruleSet,
        }
        db.ruleSet.push(ruleSetWithId);
        return ruleSetWithId;
    },
    /**
    * Save a cashback and returns it.
    *
    * @param {object} cashback The ruleset to be saved.
    * @return {object} Saved cashback.
    */
    addCashback : async (cashback)=>{
        let cashbackWithId = {
            id:`CB-${moment().toDate().getTime()}`,
            ...cashback,
        }
        db.cashback.push(cashbackWithId);        
        return cashbackWithId;
    },
    /**
    * Fetch all ruleset.
    *
    * @return {array} All ruleset.
    */
    getAllRuleSet : async ()=>{
        return db.ruleSet;
    },
    /**
    * Save a transaction and returns it.
    *
    * @param {object} transaction The ruleset to be saved.
    * @return {object} Saved transaction.
    */
    addTransaction : async (transaction)=>{
        db.transaction.push(transaction);
        return transaction;
    },
    /**
    * Fetch all transaction.
    *
    * @return {array} All transaction.
    */
    getAllTransaction : async ()=>{
        return db.transaction;
    },
    /**
    * Fetch all cashback.
    *
    * @return {array} All Cashback.
    */
    getAllCashback : async ()=>{
        return db.cashback.map((cashback)=>{
            return{
                transactionId: cashback.transactionId,
                amount: cashback.amount
            }
        });
    },
    /**
    * Find ruleset on the basis of date.
    *
    * @param {string} date The ruleset to be saved.
    * @return {object} Saved ruleset.
    */
    getRulesetbyDate: async (date)=>{
        return db.ruleSet.filter((ruleSet)=>{
            return (moment(date) >= moment(ruleSet.startDate) && moment(date) <= moment(ruleSet.endDate))
        })
    },
    /**
    * Fetch transcation count of a perticular customer.
    *
    * @param {string} customerId The customer id.
    * @return {number} Number of transaction done by customer.
    */
    getTransactionCountByCustomer: async (customerId)=>{
        return db.transaction.filter((transaction)=>{
            return (transaction.customerId === customerId)
        }).length;
    },
    /**
    * check if specified ruleset is already utlilized by customer.
    *
    * @param {string} rulesetId The ruleset id.
    * @param {string} customerId The customer id.
    * @return {boolean} if ruleset is utilized or not.
    */
    checkRulesetAppliedByCustomer: async (ruleSetId, customerId)=>{
        let checkRuleset = db.cashback.filter((cashback)=>{
            return ((cashback.ruleSetId == ruleSetId) && cashback.customerId == customerId);
        })
        if(checkRuleset.length > 0){
            return true
        }else{
            return false
        }
    },
    /**
    * Update ruleset based on exhausted parameters.
    *
    * @param {string} rulesetId The ruleset id.
    * @param {object} params exhausted parameters.
    * @return {boolean} stating cashback updated.
    */
    updateRulesetBudgetRedLim: async (ruleSetId, params)=>{
        if(Object.keys(params).length > 0){
            db.ruleSet.forEach((ruleset, index)=>{
                if(ruleset.id == ruleSetId){
                    if(params.substractBudgetBy != undefined){
                        db.ruleSet[index].pendingBudget = db.ruleSet[index].pendingBudget - params.substractBudgetBy
                    }
                    if(params.substractRedemptionLimitBy != undefined){
                        db.ruleSet[index].pendingRedemptionLimit = db.ruleSet[index].pendingRedemptionLimit - params.substractRedemptionLimitBy
                    }
                }
            })
        }
        return true
    }
}

app.use(bodyParser.urlencoded({ extended: false })) 
app.use(bodyParser.json({limit: '100mb'}));
app.use(bodyParser.urlencoded({limit: '100mb', extended: true}));

app.use(cors({
    origin: '*',
    credentials: true
}))

// POST request to add a ruleset
app.post('/ruleset', addRuleSet);

// POST request to add a transaction
app.post('/transaction', addTransaction);

// GET request to add a cashback
app.get('/cashback', getCashback);

/**
    * POST /ruleset controller.
    *
    * @param {string} req node request.
    * @param {string} req node response.
    * @return {response} returns response.
*/
async function addRuleSet(req, res){
    try{
        var ruleSet = req.body;
        if(ruleSet.redemptionLimit != undefined){
            ruleSet.pendingRedemptionLimit = ruleSet.redemptionLimit
        }

        if(ruleSet.budget != undefined){
            ruleSet.pendingBudget = ruleSet.budget
        }

        const savedRuleSet = await models.addRuleSet(ruleSet);
        res.status(200).send({
            success:true,
            ruleSet: {
                startDate: savedRuleSet.startDate,
                endDate: savedRuleSet.endDate,
                cashback: savedRuleSet.cashback,
                redemptionLimit: savedRuleSet.redemptionLimit,
                minTransactions: savedRuleSet.minTransactions,
                budget: savedRuleSet.budget,
                id: savedRuleSet.id
            }
        })
    }catch(error){
        res.status(500).send({
            success:false,
            message:"failed"
        })
    }
}

/**
    * POST /transaction controller.
    *
    * @param {string} req node request.
    * @param {string} req node response.
    * @return {response} returns response.
*/
async function addTransaction(req, res){
    try{
        var transaction = req.body;
        const savedTransaction = await models.addTransaction(transaction);
        // addCashback processing can be moved to queue, because of limitation it is implemented as a function
        await addCashback(transaction);

        res.status(200).send({
            success:true,
            transaction: savedTransaction,
        })
    }catch(error){
        console.log(error);
        res.status(500).send({
            success:false,
            message:"failed"
        })
    }
}

/**
    * GET /cashback controller.
    *
    * @param {string} req node request.
    * @param {string} req node response.
    * @return {response} returns response.
*/
async function getCashback(req, res){
    try{
        res.status(200).send({
            success:true,
            cashback: await models.getAllCashback()
        })
    }catch(error){
        res.status(500).send({
            success:false,
            message:"failed"
        })
    }
}

async function getApplicableCashback(applicableRuleset, transaction, existingTransactionCount){
    let applicableCashbacks = []
    applicableRuleset.forEach(async (ruleSet)=>{
        let rulesetAlreadyApplied = await models.checkRulesetAppliedByCustomer(ruleSet, transaction.customerId);
        if(
            !rulesetAlreadyApplied 
            && existingTransactionCount >= ruleSet.minTransactions
            && ruleSet.pendingRedemptionLimit > 0
        ){
            applicableCashbacks.push({
                ruleSetId: ruleSet.id,
                customerId: transaction.customerId,
                transactionId: transaction.id,
                amount: parseInt(ruleSet.pendingBudget) < parseInt(ruleSet.amount) ? parseInt(ruleSet.pendingBudget) : parseInt(ruleSet.amount)
            })
        }
    })
    return applicableCashbacks;
}

async function getMaximumCashback(applicableCashbacks){
    let maximumCashback = null
    
    if(applicableCashbacks.length > 0){
        if(applicableCashbacks.length == 1){
            maximumCashback = applicableCashbacks[0];
        }else{
            maximumCashback = applicableCashbacks.sort((a,b)=>{
                return a.amount < b.amount ? 1 : -1;
            })[0];
        }
    }

    return maximumCashback
}

/**
    * Add cashback associated with transaction.
    *
    * @param {object} transaction The transaction fo which cashback has to be added.
    * @return {boolean} returns confirmation if its added or not.
*/
async function addCashback(transaction){
    try{
        // Get applicable ruleset based on date.
        let applicableRuleset = await models.getRulesetbyDate(transaction.date);
        // Get number of transaction done by customer.
        let existingTransactionCount = await models.getTransactionCountByCustomer(transaction.customerId) - 1;
        // Calculate applicable cashbacks.
        let applicableCashbacks = await getApplicableCashback(applicableRuleset, transaction, existingTransactionCount)
        // Find Maximum cashbacks based on applicable cashbacks.
        let maximumCashback = await getMaximumCashback(applicableCashbacks)
        if(maximumCashback){
            // Add applied cashback in db.
            let cashback = await models.addCashback(maximumCashback);
            // Updated exhausted parameters in ruleset.
            await models.updateRulesetBudgetRedLim(cashback.rulesetId, {
                substractBudgetBy: cashback.amount,
                substractRedemptionLimitBy: 1
            });
        }
        return true
    }catch(error){
        throw error;
    }
}

// Starting node server
app.listen(port,()=>{
    console.log("Server running on port "+port);
})