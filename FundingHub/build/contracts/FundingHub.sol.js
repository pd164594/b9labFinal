var Web3 = require("web3");
var SolidityEvent = require("web3/lib/web3/event.js");

(function() {
  // Planned for future features, logging, etc.
  function Provider(provider) {
    this.provider = provider;
  }

  Provider.prototype.send = function() {
    this.provider.send.apply(this.provider, arguments);
  };

  Provider.prototype.sendAsync = function() {
    this.provider.sendAsync.apply(this.provider, arguments);
  };

  var BigNumber = (new Web3()).toBigNumber(0).constructor;

  var Utils = {
    is_object: function(val) {
      return typeof val == "object" && !Array.isArray(val);
    },
    is_big_number: function(val) {
      if (typeof val != "object") return false;

      // Instanceof won't work because we have multiple versions of Web3.
      try {
        new BigNumber(val);
        return true;
      } catch (e) {
        return false;
      }
    },
    merge: function() {
      var merged = {};
      var args = Array.prototype.slice.call(arguments);

      for (var i = 0; i < args.length; i++) {
        var object = args[i];
        var keys = Object.keys(object);
        for (var j = 0; j < keys.length; j++) {
          var key = keys[j];
          var value = object[key];
          merged[key] = value;
        }
      }

      return merged;
    },
    promisifyFunction: function(fn, C) {
      var self = this;
      return function() {
        var instance = this;

        var args = Array.prototype.slice.call(arguments);
        var tx_params = {};
        var last_arg = args[args.length - 1];

        // It's only tx_params if it's an object and not a BigNumber.
        if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
          tx_params = args.pop();
        }

        tx_params = Utils.merge(C.class_defaults, tx_params);

        return new Promise(function(accept, reject) {
          var callback = function(error, result) {
            if (error != null) {
              reject(error);
            } else {
              accept(result);
            }
          };
          args.push(tx_params, callback);
          fn.apply(instance.contract, args);
        });
      };
    },
    synchronizeFunction: function(fn, instance, C) {
      var self = this;
      return function() {
        var args = Array.prototype.slice.call(arguments);
        var tx_params = {};
        var last_arg = args[args.length - 1];

        // It's only tx_params if it's an object and not a BigNumber.
        if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
          tx_params = args.pop();
        }

        tx_params = Utils.merge(C.class_defaults, tx_params);

        return new Promise(function(accept, reject) {

          var decodeLogs = function(logs) {
            return logs.map(function(log) {
              var logABI = C.events[log.topics[0]];

              if (logABI == null) {
                return null;
              }

              var decoder = new SolidityEvent(null, logABI, instance.address);
              return decoder.decode(log);
            }).filter(function(log) {
              return log != null;
            });
          };

          var callback = function(error, tx) {
            if (error != null) {
              reject(error);
              return;
            }

            var timeout = C.synchronization_timeout || 240000;
            var start = new Date().getTime();

            var make_attempt = function() {
              C.web3.eth.getTransactionReceipt(tx, function(err, receipt) {
                if (err) return reject(err);

                if (receipt != null) {
                  // If they've opted into next gen, return more information.
                  if (C.next_gen == true) {
                    return accept({
                      tx: tx,
                      receipt: receipt,
                      logs: decodeLogs(receipt.logs)
                    });
                  } else {
                    return accept(tx);
                  }
                }

                if (timeout > 0 && new Date().getTime() - start > timeout) {
                  return reject(new Error("Transaction " + tx + " wasn't processed in " + (timeout / 1000) + " seconds!"));
                }

                setTimeout(make_attempt, 1000);
              });
            };

            make_attempt();
          };

          args.push(tx_params, callback);
          fn.apply(self, args);
        });
      };
    }
  };

  function instantiate(instance, contract) {
    instance.contract = contract;
    var constructor = instance.constructor;

    // Provision our functions.
    for (var i = 0; i < instance.abi.length; i++) {
      var item = instance.abi[i];
      if (item.type == "function") {
        if (item.constant == true) {
          instance[item.name] = Utils.promisifyFunction(contract[item.name], constructor);
        } else {
          instance[item.name] = Utils.synchronizeFunction(contract[item.name], instance, constructor);
        }

        instance[item.name].call = Utils.promisifyFunction(contract[item.name].call, constructor);
        instance[item.name].sendTransaction = Utils.promisifyFunction(contract[item.name].sendTransaction, constructor);
        instance[item.name].request = contract[item.name].request;
        instance[item.name].estimateGas = Utils.promisifyFunction(contract[item.name].estimateGas, constructor);
      }

      if (item.type == "event") {
        instance[item.name] = contract[item.name];
      }
    }

    instance.allEvents = contract.allEvents;
    instance.address = contract.address;
    instance.transactionHash = contract.transactionHash;
  };

  // Use inheritance to create a clone of this contract,
  // and copy over contract's static functions.
  function mutate(fn) {
    var temp = function Clone() { return fn.apply(this, arguments); };

    Object.keys(fn).forEach(function(key) {
      temp[key] = fn[key];
    });

    temp.prototype = Object.create(fn.prototype);
    bootstrap(temp);
    return temp;
  };

  function bootstrap(fn) {
    fn.web3 = new Web3();
    fn.class_defaults  = fn.prototype.defaults || {};

    // Set the network iniitally to make default data available and re-use code.
    // Then remove the saved network id so the network will be auto-detected on first use.
    fn.setNetwork("default");
    fn.network_id = null;
    return fn;
  };

  // Accepts a contract object created with web3.eth.contract.
  // Optionally, if called without `new`, accepts a network_id and will
  // create a new version of the contract abstraction with that network_id set.
  function Contract() {
    if (this instanceof Contract) {
      instantiate(this, arguments[0]);
    } else {
      var C = mutate(Contract);
      var network_id = arguments.length > 0 ? arguments[0] : "default";
      C.setNetwork(network_id);
      return C;
    }
  };

  Contract.currentProvider = null;

  Contract.setProvider = function(provider) {
    var wrapped = new Provider(provider);
    this.web3.setProvider(wrapped);
    this.currentProvider = provider;
  };

  Contract.new = function() {
    if (this.currentProvider == null) {
      throw new Error("FundingHub error: Please call setProvider() first before calling new().");
    }

    var args = Array.prototype.slice.call(arguments);

    if (!this.unlinked_binary) {
      throw new Error("FundingHub error: contract binary not set. Can't deploy new instance.");
    }

    var regex = /__[^_]+_+/g;
    var unlinked_libraries = this.binary.match(regex);

    if (unlinked_libraries != null) {
      unlinked_libraries = unlinked_libraries.map(function(name) {
        // Remove underscores
        return name.replace(/_/g, "");
      }).sort().filter(function(name, index, arr) {
        // Remove duplicates
        if (index + 1 >= arr.length) {
          return true;
        }

        return name != arr[index + 1];
      }).join(", ");

      throw new Error("FundingHub contains unresolved libraries. You must deploy and link the following libraries before you can deploy a new version of FundingHub: " + unlinked_libraries);
    }

    var self = this;

    return new Promise(function(accept, reject) {
      var contract_class = self.web3.eth.contract(self.abi);
      var tx_params = {};
      var last_arg = args[args.length - 1];

      // It's only tx_params if it's an object and not a BigNumber.
      if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
        tx_params = args.pop();
      }

      tx_params = Utils.merge(self.class_defaults, tx_params);

      if (tx_params.data == null) {
        tx_params.data = self.binary;
      }

      // web3 0.9.0 and above calls new twice this callback twice.
      // Why, I have no idea...
      var intermediary = function(err, web3_instance) {
        if (err != null) {
          reject(err);
          return;
        }

        if (err == null && web3_instance != null && web3_instance.address != null) {
          accept(new self(web3_instance));
        }
      };

      args.push(tx_params, intermediary);
      contract_class.new.apply(contract_class, args);
    });
  };

  Contract.at = function(address) {
    if (address == null || typeof address != "string" || address.length != 42) {
      throw new Error("Invalid address passed to FundingHub.at(): " + address);
    }

    var contract_class = this.web3.eth.contract(this.abi);
    var contract = contract_class.at(address);

    return new this(contract);
  };

  Contract.deployed = function() {
    if (!this.address) {
      throw new Error("Cannot find deployed address: FundingHub not deployed or address not set.");
    }

    return this.at(this.address);
  };

  Contract.defaults = function(class_defaults) {
    if (this.class_defaults == null) {
      this.class_defaults = {};
    }

    if (class_defaults == null) {
      class_defaults = {};
    }

    var self = this;
    Object.keys(class_defaults).forEach(function(key) {
      var value = class_defaults[key];
      self.class_defaults[key] = value;
    });

    return this.class_defaults;
  };

  Contract.extend = function() {
    var args = Array.prototype.slice.call(arguments);

    for (var i = 0; i < arguments.length; i++) {
      var object = arguments[i];
      var keys = Object.keys(object);
      for (var j = 0; j < keys.length; j++) {
        var key = keys[j];
        var value = object[key];
        this.prototype[key] = value;
      }
    }
  };

  Contract.all_networks = {
  "default": {
    "abi": [
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "projects",
        "outputs": [
          {
            "name": "",
            "type": "address"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "address"
          },
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "userProjects",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [],
        "name": "kill",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "totalNumberProjects",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "getAllProjects",
        "outputs": [
          {
            "name": "",
            "type": "address[]"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "_amountToBeRaised",
            "type": "uint256"
          },
          {
            "name": "_deadline",
            "type": "uint256"
          },
          {
            "name": "_title",
            "type": "string"
          },
          {
            "name": "_description",
            "type": "string"
          }
        ],
        "name": "createProject",
        "outputs": [
          {
            "name": "",
            "type": "address"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "user",
            "type": "address"
          }
        ],
        "name": "getUserProjects",
        "outputs": [
          {
            "name": "",
            "type": "address[]"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "inputs": [],
        "payable": false,
        "type": "constructor"
      },
      {
        "payable": false,
        "type": "fallback"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "projectAddress",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "creator",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "title",
            "type": "string"
          }
        ],
        "name": "projectCreated",
        "type": "event"
      }
    ],
    "unlinked_binary": "0x606060405234610000575b60008054600160a060020a03191633600160a060020a03161790555b5b611170806100366000396000f300606060405236156100675763ffffffff60e060020a600035041663107046bd81146100795780632fa9c007146100a557806341c0e1b5146100d357806379e656fe146100e257806380d0382914610101578063b4aeabbe14610169578063e32e723c14610219575b34610000576100775b610000565b565b005b346100005761008960043561028d565b60408051600160a060020a039092168252519081900360200190f35b34610000576100c1600160a060020a03600435166024356102bd565b60408051918252519081900360200190f35b34610000576100776102ec565b005b34610000576100c1610318565b60408051918252519081900360200190f35b346100005761010e61031e565b6040805160208082528351818301528351919283929083019185810191028083838215610156575b80518252602083111561015657601f199092019160209182019101610136565b5050509050019250505060405180910390f35b3461000057604080516020600460443581810135601f810184900484028501840190955284845261008994823594602480359560649492939190920191819084018382808284375050604080516020601f89358b0180359182018390048302840183019094528083529799988101979196509182019450925082915084018382808284375094965061039c95505050505050565b60408051600160a060020a039092168252519081900360200190f35b346100005761010e600160a060020a03600435166106bf565b6040805160208082528351818301528351919283929083019185810191028083838215610156575b80518252602083111561015657601f199092019160209182019101610136565b5050509050019250505060405180910390f35b600381815481101561000057906000526020600020900160005b915054906101000a9004600160a060020a031681565b600160205281600052604060002081815481101561000057906000526020600020900160005b91509150505481565b60005433600160a060020a0390811691161461030757610000565b600054600160a060020a0316ff5b5b565b60025481565b6040805160208101909152600080825234111561033a57610000565b600380548060200260200160405190810160405280929190818152602001828054801561039057602002820191906000526020600020905b8154600160a060020a03168152600190910190602001808311610372575b505050505090505b5b90565b60006000338686868660006002546040516109ae806107978339018088600160a060020a0316600160a060020a031681526020018781526020018681526020018060200180602001858152602001848152602001838103835287818151815260200191508051906020019080838360008314610433575b80518252602083111561043357601f199092019160209182019101610413565b505050905090810190601f16801561045f5780820380516001836020036101000a031916815260200191505b508381038252865181528651602091820191880190808383821561049e575b80518252602083111561049e57601f19909201916020918201910161047e565b505050905090810190601f1680156104ca5780820380516001836020036101000a031916815260200191505b509950505050505050505050604051809103906000f080156100005790506003805480600101828181548183558181151161052a5760008381526020902061052a9181019083015b808211156105265760008155600101610512565b5090565b5b505050916000526020600020900160005b83909190916101000a815481600160a060020a030219169083600160a060020a03160217905550506001600033600160a060020a0316600160a060020a0316815260200190815260200160002080548060010182818154818355818115116105c9576000838152602090206105c99181019083015b808211156105265760008155600101610512565b5090565b5b505050916000526020600020900160005b506002805491829055600190910190555060408051600160a060020a03808416825233908116602080840191909152606093830184815288519484019490945287517f4fed871dbf47fc7c8ad008ff12da17c18f2fdd2e0ea7ecdab3558bfd9691c3399486948a93909260808401918501908083838215610677575b80518252602083111561067757601f199092019160209182019101610657565b505050905090810190601f1680156106a35780820380516001836020036101000a031916815260200191505b5094505050505060405180910390a18091505b50949350505050565b602060405190810160405280600081525060206040519081016040528060008152506000600060003411156106f357610000565b5050600160a060020a0383166000908152600160205260408120905b81548110156107895760038282815481101561000057906000526020600020900160005b5054815481101561000057906000526020600020900160005b9054906101000a9004600160a060020a03168382815181101561000057600160a060020a039092166020928302909101909101525b60010161070f565b8293505b5b5050509190505600606060405234610000576040516109ae3803806109ae83398101604090815281516020830151918301516060840151608085015160a086015160c0870151949693949284019391909101915b6000861161005857610000565b42851161006457610000565b60018054600160a060020a03338116600160a060020a031992831617835560008054918b1691909216178155600584905585516002805492819052926020601f60001992851615610100029290920190931684900481018390047f405787fa12a823e0f2b7631cc41b3ba8828b3321ca811111fa75cd3aa3bb5ace9081019390919089019083901061010157805160ff191683800117855561012e565b8280016001018555821561012e579182015b8281111561012e578251825591602001919060010190610113565b5b5061014f9291505b8082111561014b5760008155600101610137565b5090565b50508260039080519060200190828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f1061019d57805160ff19168380011785556101ca565b828001600101855582156101ca579182015b828111156101ca5782518255916020019190600101906101af565b5b506101eb9291505b8082111561014b5760008155600101610137565b5090565b505060048690554260075560068590556008819055600b805460ff191690555b505050505050505b61078c806102226000396000f300606060405236156100bf5763ffffffff60e060020a60003504166305b3441081146100d157806329dcb0cf146100f057806332c1f2451461010f5780633cb5d1001461013a5780634a79d50c14610166578063590e1ae3146101f357806363bd1d4a146102125780637284e416146102315780637b3e5e7b146102be57806390f996f5146102dd578063a541a2a2146102fc578063af640d0f14610325578063b60d428814610344578063c2e39a7314610360578063f9b8057f14610381575b34610000576100cf5b610000565b565b005b34610000576100de6103aa565b60408051918252519081900360200190f35b34610000576100de6103b0565b60408051918252519081900360200190f35b34610000576100de600160a060020a03600435166103b6565b60408051918252519081900360200190f35b346100005761014a6004356103d5565b60408051600160a060020a039092168252519081900360200190f35b3461000057610173610405565b6040805160208082528351818301528351919283929083019185019080838382156101b9575b8051825260208311156101b957601f199092019160209182019101610199565b505050905090810190601f1680156101e55780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b34610000576100de610490565b60408051918252519081900360200190f35b34610000576100de61050f565b60408051918252519081900360200190f35b34610000576101736105a7565b6040805160208082528351818301528351919283929083019185019080838382156101b9575b8051825260208311156101b957601f199092019160209182019101610199565b505050905090810190601f1680156101e55780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b34610000576100de610635565b60408051918252519081900360200190f35b34610000576100de61063b565b60408051918252519081900360200190f35b346100005761014a610641565b60408051600160a060020a039092168252519081900360200190f35b34610000576100de610650565b60408051918252519081900360200190f35b61034c610656565b604080519115158252519081900360200190f35b346100005761034c610748565b604080519115158252519081900360200190f35b346100005761014a610751565b60408051600160a060020a039092168252519081900360200190f35b60075481565b60065481565b600160a060020a0381166000908152600960205260409020545b919050565b600a81815481101561000057906000526020600020900160005b915054906101000a9004600160a060020a031681565b6002805460408051602060018416156101000260001901909316849004601f810184900484028201840190925281815292918301828280156104885780601f1061045d57610100808354040283529160200191610488565b820191906000526020600020905b81548152906001019060200180831161046b57829003601f168201915b505050505081565b600160a060020a03331660008181526009602052604080822080549083905560058054829003905590519192909182156108fc0290839085818181858888f193505050501515610506576005805482019055600160a060020a03331660009081526009602052604090208190556002915061050b565b600391505b5090565b6000805433600160a060020a0390811691161461052e575060006105a4565b6004546005541015610542575060016105a4565b600b5460ff1615610555575060036105a4565b600b805460ff19166001179055600554604051600160a060020a0333169180156108fc02916000818181858888f1935050505015156105a05750600b805460ff1916905560046105a4565b5060055b90565b6003805460408051602060026001851615610100026000190190941693909304601f810184900484028201840190925281815292918301828280156104885780601f1061045d57610100808354040283529160200191610488565b820191906000526020600020905b81548152906001019060200180831161046b57829003601f168201915b505050505081565b60055481565b60045481565b600054600160a060020a031681565b60085481565b600034151561066457610000565b60065442111561067357610000565b600454600554111561068457610000565b600160a060020a033316600090815260096020526040902054151561071757600a80548060010182818154818355818115116106e5576000838152602090206106e59181019083015b8082111561050b57600081556001016106cd565b5090565b5b505050916000526020600020900160005b8154600160a060020a033381166101009390930a92830292021916179055505b50600160a060020a033316600090815260096020526040902080543490810190915560058054909101905560015b90565b600b5460ff1681565b600154600160a060020a0316815600a165627a7a7230582020834dcc80ca4dce8843f3536a07c2bb8e2166cc95ae6bc3bd4e037a410a86180029a165627a7a723058202017a895c65ee6c6a589788c7373d946d727a6b6b2114954470395a54771a9410029",
    "events": {
      "0x4fed871dbf47fc7c8ad008ff12da17c18f2fdd2e0ea7ecdab3558bfd9691c339": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "projectAddress",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "creator",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "title",
            "type": "string"
          }
        ],
        "name": "projectCreated",
        "type": "event"
      }
    },
    "updated_at": 1490828143965,
    "links": {},
    "address": "0xbf4b1a36dd6a898fe27d9cbdd5efa7563f2326c9"
  }
};

  Contract.checkNetwork = function(callback) {
    var self = this;

    if (this.network_id != null) {
      return callback();
    }

    this.web3.version.network(function(err, result) {
      if (err) return callback(err);

      var network_id = result.toString();

      // If we have the main network,
      if (network_id == "1") {
        var possible_ids = ["1", "live", "default"];

        for (var i = 0; i < possible_ids.length; i++) {
          var id = possible_ids[i];
          if (Contract.all_networks[id] != null) {
            network_id = id;
            break;
          }
        }
      }

      if (self.all_networks[network_id] == null) {
        return callback(new Error(self.name + " error: Can't find artifacts for network id '" + network_id + "'"));
      }

      self.setNetwork(network_id);
      callback();
    })
  };

  Contract.setNetwork = function(network_id) {
    var network = this.all_networks[network_id] || {};

    this.abi             = this.prototype.abi             = network.abi;
    this.unlinked_binary = this.prototype.unlinked_binary = network.unlinked_binary;
    this.address         = this.prototype.address         = network.address;
    this.updated_at      = this.prototype.updated_at      = network.updated_at;
    this.links           = this.prototype.links           = network.links || {};
    this.events          = this.prototype.events          = network.events || {};

    this.network_id = network_id;
  };

  Contract.networks = function() {
    return Object.keys(this.all_networks);
  };

  Contract.link = function(name, address) {
    if (typeof name == "function") {
      var contract = name;

      if (contract.address == null) {
        throw new Error("Cannot link contract without an address.");
      }

      Contract.link(contract.contract_name, contract.address);

      // Merge events so this contract knows about library's events
      Object.keys(contract.events).forEach(function(topic) {
        Contract.events[topic] = contract.events[topic];
      });

      return;
    }

    if (typeof name == "object") {
      var obj = name;
      Object.keys(obj).forEach(function(name) {
        var a = obj[name];
        Contract.link(name, a);
      });
      return;
    }

    Contract.links[name] = address;
  };

  Contract.contract_name   = Contract.prototype.contract_name   = "FundingHub";
  Contract.generated_with  = Contract.prototype.generated_with  = "3.2.0";

  // Allow people to opt-in to breaking changes now.
  Contract.next_gen = false;

  var properties = {
    binary: function() {
      var binary = Contract.unlinked_binary;

      Object.keys(Contract.links).forEach(function(library_name) {
        var library_address = Contract.links[library_name];
        var regex = new RegExp("__" + library_name + "_*", "g");

        binary = binary.replace(regex, library_address.replace("0x", ""));
      });

      return binary;
    }
  };

  Object.keys(properties).forEach(function(key) {
    var getter = properties[key];

    var definition = {};
    definition.enumerable = true;
    definition.configurable = false;
    definition.get = getter;

    Object.defineProperty(Contract, key, definition);
    Object.defineProperty(Contract.prototype, key, definition);
  });

  bootstrap(Contract);

  if (typeof module != "undefined" && typeof module.exports != "undefined") {
    module.exports = Contract;
  } else {
    // There will only be one version of this contract in the browser,
    // and we can use that.
    window.FundingHub = Contract;
  }
})();
