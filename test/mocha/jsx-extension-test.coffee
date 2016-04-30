spTransform = require '../../src/spTransform'

assertStrictEqual = (code, expected, options)->
    assert.strictEqual spTransform(code, options), expected
    assert.strictEqual spTransform(expected, options), expected
    return

describe 'jsx extension', ->
    delegateEvents = [
        'blur'
        'change'
        'click'
        'drag'
        'drop'
        'focus'
        'input'
        'load'
        'mouseenter'
        'mouseleave'
        'mousemove'
        'propertychange'
        'reset'
        'scroll'
        'submit'

        'abort'
        'canplay'
        'canplaythrough'
        'durationchange'
        'emptied'
        'encrypted'
        'ended'
        'error'
        'loadeddata'
        'loadedmetadata'
        'loadstart'
        'pause'
        'play'
        'playing'
        'progress'
        'ratechange'
        'seeked'
        'seeking'
        'stalled'
        'suspend'
        'timeupdate'
        'volumechange'
        'waiting'
    ]

    it 'should transform sp[event]', ->
        @timeout 3000

        for type in delegateEvents
            type = type[0].toUpperCase() + type.substring(1)

            code = """<button sp#{type}={ this.changeLanguage(event, lng) } />"""
            expected = """<button on#{type}={ (function(event, domID, originalEvent) { this.changeLanguage(event, lng) }).bind(this) } />"""
            assertStrictEqual code, expected

            code = """<button type="button" sp#{type}={ this.changeLanguage(event, lng) } className="btn btn-default">
                { i18n.t('name', {lng: locale}) }
            </button>"""
            expected = """<button type="button" on#{type}={ (function(event, domID, originalEvent) { this.changeLanguage(event, lng) }).bind(this) } className="btn btn-default">
                { i18n.t('name', {lng: locale}) }
            </button>"""

            code = """<button type="button" className="btn btn-default" sp#{type}={ this.changeLanguage(event, lng) }>
                { i18n.t('name', {lng: locale}) }
            </button>"""
            expected = """<button type="button" className="btn btn-default" on#{type}={ (function(event, domID, originalEvent) { this.changeLanguage(event, lng) }).bind(this) }>
                { i18n.t('name', {lng: locale}) }
            </button>"""

            code = """<button sp#{type}={ this.changeLanguage(event, lng) } />"""
            expected = """<button on#{type}={ (function(event, domID, originalEvent) { this.changeLanguage(event, lng) }).bind(this) } />"""
            assertStrictEqual code, expected

            code = """<button type="button" className="btn btn-default" sp#{type}={ this.changeLanguage(event, lng) }>
                {/* some comment */}
                { i18n.t('name', {lng: locale}) }
            </button>"""
            expected = """<button type="button" className="btn btn-default" on#{type}={ (function(event, domID, originalEvent) { this.changeLanguage(event, lng) }).bind(this) }>
                {/* some comment */}
                { i18n.t('name', {lng: locale}) }
            </button>"""
            assertStrictEqual code, expected

            code = """freact = function() {
              return <button sp#{type}={ this.changeLanguage(event, lng) } />;
            };"""
            expected = """freact = function() {
              return <button on#{type}={ (function(event, domID, originalEvent) { this.changeLanguage(event, lng) }).bind(this) } />;
            };"""
            assertStrictEqual code, expected

        return

    it 'should transform nested sp[event]', ->
        for type in delegateEvents
            type = type[0].toUpperCase() + type.substring(1)

            code = """<button type="button" className="btn btn-default" sp#{type}={ this.changeLanguage(event, lng) }>
                {/* some comment */}
                { i18n.t('name', {lng: locale}) }
                <button sp#{type}={ this.changeLanguage(event, lng) } />
            </button>"""
            expected = """<button type="button" className="btn btn-default" on#{type}={ (function(event, domID, originalEvent) { this.changeLanguage(event, lng) }).bind(this) }>
                {/* some comment */}
                { i18n.t('name', {lng: locale}) }
                <button on#{type}={ (function(event, domID, originalEvent) { this.changeLanguage(event, lng) }).bind(this) } />
            </button>"""
            assertStrictEqual code, expected

        return

    it 'should transform sp[event] + spRepeat', ->
        for type in delegateEvents
            type = type[0].toUpperCase() + type.substring(1)

            code = """<button spRepeat="(locale, lng) in locales" sp#{type}={ this.changeLanguage(event, lng) } />"""
            expected = """_.map(locales, function(locale, lng) {return (<button  on#{type}={ (function(event, domID, originalEvent) { this.changeLanguage(event, lng) }).bind(this) } />)}.bind(this))"""
            assertStrictEqual code, expected
        return

    it 'should transform nested sp[event] + spRepeat', ->
        for type in delegateEvents
            type = type[0].toUpperCase() + type.substring(1)

            code = """<button spRepeat="(locale, lng) in locales" type="button" className="btn btn-default">
                { i18n.t('name', {lng: locale}) }
                <button spRepeat="(locale, lng) in locales" sp#{type}={ this.changeLanguage(event, lng) } />
            </button>"""
            expected = """_.map(locales, function(locale, lng) {return (<button  type="button" className="btn btn-default">
                { i18n.t('name', {lng: locale}) }
                { _.map(locales, function(locale, lng) {return (<button  on#{type}={ (function(event, domID, originalEvent) { this.changeLanguage(event, lng) }).bind(this) } />)}.bind(this)) }
            </button>)}.bind(this))"""
            assertStrictEqual code, expected

            code = """var freact;

            freact = function() {
              return <button spRepeat="lng in locales" sp#{type}={ this.changeLanguage(event, lng) } />;
            };"""
            expected = """var freact;

            freact = function() {
              return _.map(locales, function(lng) {return (<button  on#{type}={ (function(event, domID, originalEvent) { this.changeLanguage(event, lng) }).bind(this) } />)}.bind(this));
            };"""
            assertStrictEqual code, expected
        return

    it 'should transform spRepeat', ->
        code = """<button spRepeat="locale in locales"/>"""
        expected = """_.map(locales, function(locale) {return (<button />)}.bind(this))"""
        assertStrictEqual code, expected

        code = """<button spRepeat="(locale, lng) in locales"/>"""
        expected = """_.map(locales, function(locale, lng) {return (<button />)}.bind(this))"""
        assertStrictEqual code, expected

        code = """<button spRepeat="(locale, lng) in locales" type="button" className="btn btn-default" />"""
        expected = """_.map(locales, function(locale, lng) {return (<button  type="button" className="btn btn-default" />)}.bind(this))"""
        assertStrictEqual code, expected

        code = """<button spRepeat="(locale, lng) in locales" type="button" className="btn btn-default" ></button>"""
        expected = """_.map(locales, function(locale, lng) {return (<button  type="button" className="btn btn-default" ></button>)}.bind(this))"""
        assertStrictEqual code, expected

        code = """<button spRepeat="(locale, lng) in locales" type="button" className="btn btn-default">
            { i18n.t('name', {lng: locale}) }
        </button>"""
        expected = """_.map(locales, function(locale, lng) {return (<button  type="button" className="btn btn-default">
            { i18n.t('name', {lng: locale}) }
        </button>)}.bind(this))"""
        assertStrictEqual code, expected

        code = """<div>
            <button spRepeat="locale in locales"/>
            <button spRepeat="locale in locales"/>
        </div>"""

        expected = """<div>
            { _.map(locales, function(locale) {return (<button />)}.bind(this)) }
            { _.map(locales, function(locale) {return (<button />)}.bind(this)) }
        </div>"""
        assertStrictEqual code, expected

        code = """<button spRepeat={4} type="button" className="btn btn-default"/>"""

        expected = """(function() {
            var arr = new Array(4);
            for (var index = 0; index < 4; index++) {
                arr[index] = (<button  type="button" className="btn btn-default"/>);
            }
            return arr;
        }).call(this)"""
        assertStrictEqual code, expected

        return

    it 'should transform nested spRepeat', ->
        code = """<button spRepeat="(locale, lng) in locales" type="button" className="btn btn-default">
            { i18n.t('name', {lng: locale}) }
            <button spRepeat="(locale, lng) in locales" type="button" className="btn btn-default" ></button>
        </button>"""
        expected = """_.map(locales, function(locale, lng) {return (<button  type="button" className="btn btn-default">
            { i18n.t('name', {lng: locale}) }
            { _.map(locales, function(locale, lng) {return (<button  type="button" className="btn btn-default" ></button>)}.bind(this)) }
        </button>)}.bind(this))"""
        assertStrictEqual code, expected

        return

    it 'should transform spShow', ->
        code = """<button spShow={condition}/>"""
        expected = """(condition ? <button /> : void 0)"""
        assertStrictEqual code, expected

        code = """<button spShow={some(condition)}/>"""
        expected = """(some(condition) ? <button /> : void 0)"""
        assertStrictEqual code, expected

        code = """
        <div>
            <div spShow={user.invalidAttrs.postalCode} className="error-messages"></div>
            <div spShow={user.invalidAttrs.email} className="error-messages"></div>
        </div>
        """
        expected = """
        <div>
            { (user.invalidAttrs.postalCode ? <div  className="error-messages"></div> : void 0) }
            { (user.invalidAttrs.email ? <div  className="error-messages"></div> : void 0) }
        </div>
        """
        assertStrictEqual code, expected
        return

    it 'should transform spModel', ->
        code = """<button spModel={this.model.property}/>"""
        expected = """<button spModel={[this.model, 'property']}/>"""
        assertStrictEqual code, expected

        return

    it 'should transform nested spClick + spRepeat + spShow + spModel', ->
        # spClick, spRepeat
        code = """<button spClick={ this.changeLanguage(event, lng) } spRepeat="locale in locales"/>"""
        expected = """_.map(locales, function(locale) {return (<button onClick={ (function(event, domID, originalEvent) { this.changeLanguage(event, lng) }).bind(this) } />)}.bind(this))"""
        assertStrictEqual code, expected

        # spRepeat, spClick
        code = """<button spRepeat="locale in locales" spClick={ this.changeLanguage(event, lng) }/>"""
        expected = """_.map(locales, function(locale) {return (<button  onClick={ (function(event, domID, originalEvent) { this.changeLanguage(event, lng) }).bind(this) }/>)}.bind(this))"""
        assertStrictEqual code, expected

        # spClick, spShow
        code = """<button spClick={ this.changeLanguage(event, lng) } spShow={condition}/>"""
        expected = """(condition ? <button onClick={ (function(event, domID, originalEvent) { this.changeLanguage(event, lng) }).bind(this) } /> : void 0)"""
        assertStrictEqual code, expected

        # spShow, spClick
        code = """<button spShow={condition} spClick={ this.changeLanguage(event, lng) }/>"""
        expected = """(condition ? <button  onClick={ (function(event, domID, originalEvent) { this.changeLanguage(event, lng) }).bind(this) }/> : void 0)"""
        assertStrictEqual code, expected

        # spClick, spModel
        code = """<button spClick={ this.changeLanguage(event, lng) } spModel={this.model.property}/>"""
        expected = """<button onClick={ (function(event, domID, originalEvent) { this.changeLanguage(event, lng) }).bind(this) } spModel={[this.model, 'property']}/>"""
        assertStrictEqual code, expected

        # spModel, spClick
        code = """<button spModel={this.model.property} spClick={ this.changeLanguage(event, lng) }/>"""
        expected = """<button spModel={[this.model, 'property']} onClick={ (function(event, domID, originalEvent) { this.changeLanguage(event, lng) }).bind(this) }/>"""
        assertStrictEqual code, expected
        
        # spRepeat, spShow
        code = """<button spRepeat="locale in locales" spShow={condition}/>"""
        expected = """_.map(locales, function(locale) {return (condition ? <button  /> : void 0)}.bind(this))"""
        assertStrictEqual code, expected

        # spShow, spRepeat
        code = """<button spShow={condition} spRepeat="locale in locales"/>"""
        expected = """_.map(locales, function(locale) {return (condition ? <button  /> : void 0)}.bind(this))"""
        assertStrictEqual code, expected

        # spRepeat, spModel
        code = """<button spRepeat="locale in locales" spModel={this.model.property}/>"""
        expected = """_.map(locales, function(locale) {return (<button  spModel={[this.model, 'property']}/>)}.bind(this))"""
        assertStrictEqual code, expected

        # spModel, spRepeat
        code = """<button spModel={this.model.property} spRepeat="locale in locales"/>"""
        expected = """_.map(locales, function(locale) {return (<button spModel={[this.model, 'property']} />)}.bind(this))"""
        assertStrictEqual code, expected
        
        # spShow, spModel
        code = """<button spShow={condition} spModel={this.model.property}/>"""
        expected = """(condition ? <button  spModel={[this.model, 'property']}/> : void 0)"""
        assertStrictEqual code, expected

        # spModel, spShow
        code = """<button spModel={this.model.property} spShow={condition}/>"""
        expected = """(condition ? <button spModel={[this.model, 'property']} /> : void 0)"""
        assertStrictEqual code, expected

        # spClick, spRepeat, spShow
        code = """<button spClick={ this.changeLanguage(event, lng) } spRepeat="locale in locales" spShow={condition}/>"""
        expected = """_.map(locales, function(locale) {return (condition ? <button onClick={ (function(event, domID, originalEvent) { this.changeLanguage(event, lng) }).bind(this) }  /> : void 0)}.bind(this))"""
        assertStrictEqual code, expected

        # spClick, spShow, spRepeat
        code = """<button spClick={ this.changeLanguage(event, lng) } spShow={condition} spRepeat="locale in locales"/>"""
        expected = """_.map(locales, function(locale) {return (condition ? <button onClick={ (function(event, domID, originalEvent) { this.changeLanguage(event, lng) }).bind(this) }  /> : void 0)}.bind(this))"""
        assertStrictEqual code, expected

        # spRepeat, spClick, spShow
        code = """<button spRepeat="locale in locales" spClick={ this.changeLanguage(event, lng) } spShow={condition}/>"""
        expected = """_.map(locales, function(locale) {return (condition ? <button  onClick={ (function(event, domID, originalEvent) { this.changeLanguage(event, lng) }).bind(this) } /> : void 0)}.bind(this))"""
        assertStrictEqual code, expected

        # spRepeat, spShow, spClick
        code = """<button spRepeat="locale in locales" spShow={condition} spClick={ this.changeLanguage(event, lng) }/>"""
        expected = """_.map(locales, function(locale) {return (condition ? <button   onClick={ (function(event, domID, originalEvent) { this.changeLanguage(event, lng) }).bind(this) }/> : void 0)}.bind(this))"""
        assertStrictEqual code, expected

        # spShow, spRepeat, spClick
        code = """<button spShow={condition} spRepeat="locale in locales" spClick={ this.changeLanguage(event, lng) }/>"""
        expected = """_.map(locales, function(locale) {return (condition ? <button   onClick={ (function(event, domID, originalEvent) { this.changeLanguage(event, lng) }).bind(this) }/> : void 0)}.bind(this))"""
        assertStrictEqual code, expected

        # spShow, spClick, spRepeat
        code = """<button spShow={condition} spClick={ this.changeLanguage(event, lng) } spRepeat="locale in locales"/>"""
        expected = """_.map(locales, function(locale) {return (condition ? <button  onClick={ (function(event, domID, originalEvent) { this.changeLanguage(event, lng) }).bind(this) } /> : void 0)}.bind(this))"""
        assertStrictEqual code, expected
        
        # spClick, spRepeat, spModel
        code = """<button spClick={ this.changeLanguage(event, lng) } spRepeat="locale in locales" spModel={this.model.property}/>"""
        expected = """_.map(locales, function(locale) {return (<button onClick={ (function(event, domID, originalEvent) { this.changeLanguage(event, lng) }).bind(this) }  spModel={[this.model, 'property']}/>)}.bind(this))"""
        assertStrictEqual code, expected

        # spClick, spModel, spRepeat
        code = """<button spClick={ this.changeLanguage(event, lng) } spModel={this.model.property} spRepeat="locale in locales"/>"""
        expected = """_.map(locales, function(locale) {return (<button onClick={ (function(event, domID, originalEvent) { this.changeLanguage(event, lng) }).bind(this) } spModel={[this.model, 'property']} />)}.bind(this))"""
        assertStrictEqual code, expected
        
        # spRepeat, spClick, spModel
        code = """<button spClick={ this.changeLanguage(event, lng) } spRepeat="locale in locales" spModel={this.model.property}/>"""
        expected = """_.map(locales, function(locale) {return (<button onClick={ (function(event, domID, originalEvent) { this.changeLanguage(event, lng) }).bind(this) }  spModel={[this.model, 'property']}/>)}.bind(this))"""
        assertStrictEqual code, expected

        # spRepeat, spModel, spClick
        code = """<button spRepeat="locale in locales" spModel={this.model.property} spClick={ this.changeLanguage(event, lng) }/>"""
        expected = """_.map(locales, function(locale) {return (<button  spModel={[this.model, 'property']} onClick={ (function(event, domID, originalEvent) { this.changeLanguage(event, lng) }).bind(this) }/>)}.bind(this))"""
        assertStrictEqual code, expected

        # spModel, spRepeat, spClick
        code = """<button spModel={this.model.property} spRepeat="locale in locales" spClick={ this.changeLanguage(event, lng) }/>"""
        expected = """_.map(locales, function(locale) {return (<button spModel={[this.model, 'property']}  onClick={ (function(event, domID, originalEvent) { this.changeLanguage(event, lng) }).bind(this) }/>)}.bind(this))"""
        assertStrictEqual code, expected
        
        # spModel, spClick, spRepeat
        code = """<button spModel={this.model.property} spClick={ this.changeLanguage(event, lng) } spRepeat="locale in locales"/>"""
        expected = """_.map(locales, function(locale) {return (<button spModel={[this.model, 'property']} onClick={ (function(event, domID, originalEvent) { this.changeLanguage(event, lng) }).bind(this) } />)}.bind(this))"""
        assertStrictEqual code, expected
        
        # spClick, spShow, spModel
        code = """<button spClick={ this.changeLanguage(event, lng) } spShow={condition} spModel={this.model.property}/>"""
        expected = """(condition ? <button onClick={ (function(event, domID, originalEvent) { this.changeLanguage(event, lng) }).bind(this) }  spModel={[this.model, 'property']}/> : void 0)"""
        assertStrictEqual code, expected

        # spClick, spModel, spShow
        code = """<button spClick={ this.changeLanguage(event, lng) } spModel={this.model.property} spShow={condition}/>"""
        expected = """(condition ? <button onClick={ (function(event, domID, originalEvent) { this.changeLanguage(event, lng) }).bind(this) } spModel={[this.model, 'property']} /> : void 0)"""
        assertStrictEqual code, expected

        # spShow, spClick, spModel
        code = """<button spShow={condition} spClick={ this.changeLanguage(event, lng) } spModel={this.model.property}/>"""
        expected = """(condition ? <button  onClick={ (function(event, domID, originalEvent) { this.changeLanguage(event, lng) }).bind(this) } spModel={[this.model, 'property']}/> : void 0)"""
        assertStrictEqual code, expected

        # spShow, spModel, spClick
        code = """<button spShow={condition} spModel={this.model.property} spClick={ this.changeLanguage(event, lng) }/>"""
        expected = """(condition ? <button  spModel={[this.model, 'property']} onClick={ (function(event, domID, originalEvent) { this.changeLanguage(event, lng) }).bind(this) }/> : void 0)"""
        assertStrictEqual code, expected

        # spModel, spShow, spClick
        code = """<button spModel={this.model.property} spShow={condition} spClick={ this.changeLanguage(event, lng) }/>"""
        expected = """(condition ? <button spModel={[this.model, 'property']}  onClick={ (function(event, domID, originalEvent) { this.changeLanguage(event, lng) }).bind(this) }/> : void 0)"""
        assertStrictEqual code, expected

        # spModel, spClick, spShow
        code = """<button spModel={this.model.property} spClick={ this.changeLanguage(event, lng) } spShow={condition}/>"""
        expected = """(condition ? <button spModel={[this.model, 'property']} onClick={ (function(event, domID, originalEvent) { this.changeLanguage(event, lng) }).bind(this) } /> : void 0)"""
        assertStrictEqual code, expected

        # spClick, spRepeat, spShow, spModel
        # spClick, spRepeat, spModel, spShow
        # spClick, spShow, spRepeat, spModel
        # spClick, spShow, spModel, spRepeat
        # spClick, spModel, spRepeat, spShow
        # spClick, spModel, spShow, spRepeat

        # spRepeat, spClick, spShow, spModel
        # spRepeat, spClick, spModel, spShow
        # spRepeat, spShow, spClick, spModel
        # spRepeat, spShow, spModel, spClick
        # spRepeat, spModel, spClick, spShow
        # spRepeat, spModel, spShow, spClick

        # spShow, spClick, spRepeat, spModel
        # spShow, spClick, spModel, spRepeat
        # spShow, spRepeat, spClick, spModel
        # spShow, spRepeat, spModel, spClick
        # spShow, spModel, spClick, spRepeat
        # spShow, spModel, spRepeat, spClick

        # spModel, spClick, spRepeat, spShow
        # spModel, spClick, spShow, spRepeat
        # spModel, spRepeat, spClick, spShow
        # spModel, spRepeat, spShow, spClick
        # spModel, spShow, spClick, spRepeat
        # spModel, spShow, spRepeat, spClick

        code = """<button spRepeat="(locale, lng) in locales" type="button" className="btn btn-default">
            { i18n.t('name', {lng: locale}) }
            <button spShow={condition} spRepeat="locale in locales" spClick={ this.changeLanguage(event, lng) }/>
        </button>"""
        expected = """_.map(locales, function(locale, lng) {return (<button  type="button" className="btn btn-default">
            { i18n.t('name', {lng: locale}) }
            { _.map(locales, function(locale) {return (condition ? <button   onClick={ (function(event, domID, originalEvent) { this.changeLanguage(event, lng) }).bind(this) }/> : void 0)}.bind(this)) }
        </button>)}.bind(this))"""
        assertStrictEqual code, expected

        return

    it 'should respect in expression', ->
        code = """<ModelListener model={model} events="validated:translated" onEvent={function(isModel, model, invalidAttrs) { return (
            <div spRepeat="(message, attr) in invalidAttrs">{message}</div>
        )}} />"""
        expected = """<ModelListener model={model} events="validated:translated" onEvent={function(isModel, model, invalidAttrs) { return (
            _.map(invalidAttrs, function(message, attr) {return (<div >{message}</div>)}.bind(this))
        )}} />"""
        assertStrictEqual code, expected

        code = """<ModelListener model={model} events="validated:translated" onEvent={function(isModel, model, invalidAttrs) { return (
            <div spShow={invalidAttrs.password}>{invalidAttrs.password[0]}</div>
        )}} />"""
        expected = """<ModelListener model={model} events="validated:translated" onEvent={function(isModel, model, invalidAttrs) { return (
            (invalidAttrs.password ? <div >{invalidAttrs.password[0]}</div> : void 0)
        )}} />"""
        assertStrictEqual code, expected

        code = """
        <InputText input={{'select':
            <option spRepeat="(state, index) in states" value={state.abbrev} key={index}>
                {state.abbrev}
            </option>
        }} className="col-md-6" spModel={user.state} label={i18n.t('label.state')} />
        """ 
        expected = """
        <InputText input={{'select':
            _.map(states, function(state, index) {return (<option  value={state.abbrev} key={index}>
                {state.abbrev}
            </option>)}.bind(this))
        }} className="col-md-6" spModel={[user, 'state']} label={i18n.t('label.state')} />
        """
        assertStrictEqual code, expected

        code = """
        <InputText input={['select',
            <option spRepeat="(state, index) in states" value={state.abbrev} key={index}>
                {state.abbrev}
            </option>
        ]} className="col-md-6" spModel={user.state} label={i18n.t('label.state')} />
        """ 
        expected = """
        <InputText input={['select',
            _.map(states, function(state, index) {return (<option  value={state.abbrev} key={index}>
                {state.abbrev}
            </option>)}.bind(this))
        ]} className="col-md-6" spModel={[user, 'state']} label={i18n.t('label.state')} />
        """
        assertStrictEqual code, expected

        code = """
        <select>
            {(<option spRepeat="(state, index) in states" value={state.abbrev} key={index}>
                {state.abbrev}
            </option>)}
        </select>
        """
        expected = """
        <select>
            {(_.map(states, function(state, index) {return (<option  value={state.abbrev} key={index}>
                {state.abbrev}
            </option>)}.bind(this)))}
        </select>
        """
        assertStrictEqual code, expected

        return

    it 'should transform item with className mdl-', ->
        code = """
        <button type="submit" className="mdl-button mdl-js-button mdl-button--raised" >
            {i18n.t('send')}
        </button>
        """
        expected = """
        <Mdl tagName="button" type="submit" className="mdl-button mdl-js-button mdl-button--raised" >
            {i18n.t('send')}
        </Mdl>
        """
        assertStrictEqual code, expected, {mdl: 'Mdl'}

        code = """<span className="mdl-button mdl-js-button mdl-button--raised" />"""
        expected = """<Mdl tagName="span" className="mdl-button mdl-js-button mdl-button--raised" />"""
        assertStrictEqual code, expected, {mdl: 'Mdl'}

    return
