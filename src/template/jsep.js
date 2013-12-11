var COMPOUND = 'Compound',
	IDENTIFIER = 'Identifier',
	MEMBER_EXP = 'MemberExpression',
	LITERAL = 'Literal',
	THIS_EXP = 'ThisExpression',
	CALL_EXP = 'CallExpression',
	UNARY_EXP = 'UnaryExpression',
	BINARY_EXP = 'BinaryExpression',
	LOGICAL_EXP = 'LogicalExpression',
	PARENT_EXP = 'ParentExpression',
	CURR_LEVEL_EXP = 'CurrLevelExpression',
	jsep = (function (root) {
		/**
		 * Description
		 * @method do_parse
		 * @param {} expr
		 * @return CallExpression
		 */
		var unary_ops = keys(unary_operators),
			binary_ops = keys(binary_operators),
			binary_op_len = binary_ops.length,
			literals = {
				'true': true,
				'false': false,
				'null': null
			},
			this_str = 'this',
			extend = function(base_obj, extension_obj) {
				for (var prop in extension_obj) {
					if(extension_obj.hasOwnProperty(prop)) {
						base_obj[prop] = extension_obj[prop];
					}
				}
				return base_obj;
			},
			binaryPrecedence = function(op_val) {
				// Taken from the esprima parser's function
				switch (op_val) {
					case '||': return 1;
					case '&&': return 2;
					case '|': return 3;
					case '^': return 4;
					case '&': return 5;
					case '==': case '!=': case '===': case '!==': return 6;
					case '<': case '>': case '<=': case '>=': return 7;
					case '<<': case '>>': case '>>>': return 8;
					case '+': case '-': return 9;
					case '*': case '/': case '%': return 11;
				}
				return 0;
			},
			createBinaryExpression = function (operator, left, right) {
				var type = (operator === '||' || operator === '&&') ? LOGICAL_EXP : BINARY_EXP;
				return {
					type: type,
					operator: operator,
					left: left,
					right: right
				};
			},
			// ch is a character code
			isDecimalDigit = function(ch) {
				return	(ch >= 48 && ch <= 57);   // 0..9
			},
			isIdentifierStart = function(ch) {
				return	(ch === 36) || (ch === 95) ||  // $ (dollar) and _ (underscore)
						(ch === 64) || // @
						(ch >= 65 && ch <= 90) ||     // A..Z
						(ch >= 97 && ch <= 122);      // a..z
			},
			isIdentifierPart = function(ch) {
				return	(ch === 36) || (ch === 95) ||  // $ (dollar) and _ (underscore)
						(ch >= 65 && ch <= 90) ||         // A..Z
						(ch >= 97 && ch <= 122) ||        // a..z
						(ch >= 48 && ch <= 57);           // 0..9
			},
			DONE = {},


			start_str_regex = new RegExp('^[\'"]'),
			number_regex = new RegExp('^(\\d+(\\.\\d+)?)'),

			do_parse = function(expr) {
				/**
				 * Description
				 * @method gobbleGroup
				 * @return 
				 */
				var stack = [],
					index = 0,
					length = expr.length,

					gobbleExpression = function() {
						var nodes = [], ch_i, node;
						while(index < length) {
							ch_i = expr[index];

							if(ch_i === ';' || ch_i ===',') {
								index++; // ignore seperators
							} else {
								if((node = gobbleBinaryExpression())) {
									nodes.push(node);
								} else if(index < length) {
									throw new Error("Unexpected '"+expr[index]+"' at character " + index);
								}
							}
						}

						if(nodes.length === 1) {
							return nodes[0];
						} else {
							return {
								type: COMPOUND,
								body: nodes
							};
						}
					},

					gobbleBinaryOp = function() {
						var biop, i, j, op_len;
						gobbleSpaces();
						outer: for(i = 0; i<binary_op_len; i++) {
							biop = binary_ops[i];
							op_len = biop.length;
							for(j = 0; j<op_len; j++) {
								if(biop[j] !== expr[index + j]) {
									continue outer;
								}
							}
							index += op_len;
							return biop;
						}
						return false;
					},


					gobbleBinaryExpression = function() {
						var ch_i, node, biop, prec, stack, biop_info, left, right, i;

						left = gobbleToken();
						biop = gobbleBinaryOp();
						prec = binaryPrecedence(biop);

						if(prec === 0) {
							return left;
						}

						biop_info = { value: biop, prec: prec};

						right = gobbleToken();
						if(!right) {
							throw new Error("Expected expression after " + biop + " at character " + index);
						}
						stack = [left, biop_info, right];

						while((biop = gobbleBinaryOp())) {
							prec = binaryPrecedence(biop);

							if(prec === 0) {
								break;
							}
							biop_info = { value: biop, prec: prec };

							// Reduce: make a binary expression from the three topmost entries.
							while ((stack.length > 2) && (prec <= stack[stack.length - 2].prec)) {
								right = stack.pop();
								biop = stack.pop().value;
								left = stack.pop();
								node = createBinaryExpression(biop, left, right);
								stack.push(node);
							}

							node = gobbleToken();
							if(!node) {
								throw new Error("Expected expression after " + biop + " at character " + index);
							}
							stack.push(biop_info);
							stack.push(node);
						}

						i = stack.length - 1;
						node = stack[i];
						while(i > 1) {
							node = createBinaryExpression(stack[i - 1].value, stack[i - 2], node); 
							i -= 2;
						}

						return node;
					},

					gobbleToken = function() {
						var ch, curr_node, op_index;
						
						gobbleSpaces();
						ch = expr.charCodeAt(index);
						if(ch === 46 && expr.charCodeAt(index+1) === 47) {
							index += 2;
							return {
								type: CURR_LEVEL_EXP,
								argument: gobbleToken()
							};
						} else if(ch === 46 && expr.charCodeAt(index+1) === 46 && expr.charCodeAt(index+2) === 47) {
							index += 3;
							return {
								type: PARENT_EXP,
								argument: gobbleToken()
							};
						}
						
						if(isDecimalDigit(ch) || ch === 46) {
							// Char code 46 is a dot (.)
							return gobbleNumericLiteral();
						} else if(ch === 39 || ch === 34) {
							// Single or double quotes (' or ")
							return gobbleStringLiteral();
						} else if(isIdentifierStart(ch)) {
							return gobbleVariable();
						} else if((op_index = unary_ops.indexOf(ch)) >= 0) {
							index++;
							return {
								type: UNARY_EXP,
								operator: unary_ops[op_index],
								argument: gobbleToken(),
								prefix: true
							};
						} else if(ch === 40) {
							// Open parentheses
							index++;
							return gobbleGroup();
						} else {
							return false;
						}
					},

					gobbleSpaces = function() {
						var ch = expr.charCodeAt(index);
						// space or tab
						while(ch === 32 || ch === 9) {
							ch = expr.charCodeAt(++index);
						}
					},

					gobbleNumericLiteral = function() {
						var number = '';
						while(isDecimalDigit(expr.charCodeAt(index))) {
							number += expr[index++];
						}

						if(expr[index] === '.') {
							number += expr[index++];

							while(isDecimalDigit(expr.charCodeAt(index))) {
								number += expr[index++];
							}
						}

						return {
							type: LITERAL,
							value: parseFloat(number),
							raw: number
						};
					},

					gobbleStringLiteral = function() {
						var str = '', quote = expr[index++], closed = false, ch;

						while(index < length) {
							ch = expr[index++];
							if(ch === quote) {
								closed = true;
								break;
							} else if(ch === '\\') {
								ch = expr[index++];
								switch(ch) {
									case 'n': str += '\n'; break;
									case 'r': str += '\r'; break;
									case 't': str += '\t'; break;
									case 'b': str += '\b'; break;
									case 'f': str += '\f'; break;
									case 'v': str += '\x0B'; break;
								}
							} else {
								str += ch;
							}
						}

						if(!closed) {
							throw new Error('Unclosed quote after "'+str+'"');
						}

						return {
							type: LITERAL,
							value: str,
							raw: quote + str + quote
						};
					},
					
					gobbleIdentifier = function() {
						var ch = expr.charCodeAt(index), start = index, identifier;

						if(isIdentifierStart(ch)) {
							index++;
						}

						while(index < length) {
							ch = expr.charCodeAt(index);
							if(isIdentifierPart(ch)) {
								index++;
							} else {
								break;
							}
						}
						identifier = expr.slice(start, index);

						if(literals.hasOwnProperty(identifier)) {
							return {
								type: LITERAL,
								value: literals[identifier],
								raw: identifier
							};
						} else if(identifier === this_str) {
							return { type: THIS_EXP };
						} else {
							return {
								type: IDENTIFIER,
								name: identifier
							};
						}
					},

					gobbleArguments = function() {
						var ch_i, args = [], node;
						while(index < length) {
							gobbleSpaces();
							ch_i = expr[index];
							if(ch_i === ')') {
								index++;
								break;
							} else if (ch_i === ',') {
								index++;
							} else {
								node = gobbleBinaryExpression();
								if(!node || node.type === COMPOUND) {
									throw new Error('Expected comma at character ' + index);
								}
								args.push(node);
							}
						}
						return args;
					},

					gobbleVariable = function() {
						var ch_i, node, old_index;
						node = gobbleIdentifier();
						ch_i = expr[index];
						while(ch_i === '.' || ch_i === '[' || ch_i === '(') {
							if(ch_i === '.') {
								index++;
								node = {
									type: MEMBER_EXP,
									computed: false,
									object: node,
									property: gobbleIdentifier()
								};
							} else if(ch_i === '[') {
								old_index = index;
								index++;
								node = {
									type: MEMBER_EXP,
									computed: true,
									object: node,
									property: gobbleBinaryExpression()
								};
								gobbleSpaces();
								ch_i = expr[index];
								if(ch_i !== ']') {
									throw new Error('Unclosed [ at character ' + index);
								}
								index++;
							} else if(ch_i === '(') {
								index++;
								node = {
									type: CALL_EXP,
									'arguments': gobbleArguments(),
									callee: node
								};
							}
							ch_i = expr[index];
						}
						return node;
					},

					gobbleGroup = function() {
						var node = gobbleBinaryExpression();
						gobbleSpaces();
						if(expr[index] === ')') {
							index++;
							return node;
						} else {
							throw new Error('Unclosed ( at character ' + index);
						}
					};

				return gobbleExpression();
			};
		return do_parse;
	}(this));
