
# Light glob to regexp
globMatcher = do ->
    sep = '[\\/\\\\]' # separation
    nsep = '[^\\/\\\\]' # not separation
    mnsep = nsep + '*' # multiple not separation
    star = '\\*' # star
    mstar = '\\*{2,}' # multiple star
    specialPattern = new RegExp '(?:' + [
        # 1.1 # /**$ => /**: (sep, everything) or nothing
        # 1.2 # ioio/**$ => /**: (sep, everything) or nothing
        '(' + sep + mstar + '$)'

        # 2 # ouiuo/**/iuuo => /**/?: sep, (everything, sep) or nothing
        '(' + sep + mstar + sep + ')'

        # 3 # ioio/**fodpo => /**: sep, everything
        '(' + sep + mstar + ')'

        # 4.1 # **/$ => **/: everything, sep
        # 4.2 # **/iofid => **/: everything, sep
        # 4.3 # fiodu**/iofid => **/: everything, sep
        '(' + mstar + sep + ')'

        # 5.1 # ** => **: everything
        # 5.2 # iido** => **: everything
        # 5.3 # **opoio => **: everything
        '(' + mstar + ')'

        # 6 # ouiuo/*/iuuo => /*/: sep, (mnsep, sep) or nothing
        '(' + sep + star + sep + ')'

        '(' + [
            # 7.1 # /* => /*$: mnsep
            # 7.2 # ioio/* => /*$: mnsep
            sep + star + '$'

            # 7.3 # */ => */$: mnsep
            star + sep + '$'

            # 7.4 # ioio/*fodpo => *: mnsep
            # 7.5 # fiodu*/iofid => *: mnsep
            # 7.6 # iido* => *: mnsep
            # 7.7 # *opoio => *: mnsep
            # 7.8 # */iofid => *: mnsep
            # 7.9 # * => *: mnsep
            star
        ].join('|') + ')'

        # 8 escape special meaning
        # http://www.regular-expressions.info/characters.html#special
        '([' + '\\/^$.|?*+()[]{}'.split('').join('\\') + '])'

    ].join('|') + ')', 'g'

    map =
        # keep special meaning
        '|': '|'
        '$': '$'

        # ignore OS specific path sep
        '/': sep
        '\\': sep

    (str)->
        if Array.isArray str
            str = str.join('|')
        else if 'string' isnt typeof str
            return ''

        str.replace specialPattern, (match)->
            if arguments[1]
                # (sep, everything) or nothing
                return '(?:' + sep + '.*?|$)'

            if arguments[2]
                # sep, (everything, sep) or nothing
                return sep + '(?:.*?' + sep + '|)'

            if arguments[3]
                # sep, everything
                return sep + '.*?'

            if arguments[4]
                # everything, sep
                return '.*?' + sep

            if arguments[5]
                # everything
                return '.*?'

            if arguments[6]
                # sep, (mnsep, sep) or nothing
                return sep + '(?:' + mnsep + sep + '|)'

            if arguments[7]
                # mnsep
                return mnsep

            # escape special meaning
            map[match] or '\\' + match

module.exports = matcher = (include, exclude) ->
    include = globMatcher include
    exclude = globMatcher exclude

    if include.length is 0 and exclude.length is 0
        return /(?!^)^/ # never matches, similar to true === false

    if exclude.length is 0
        return new RegExp '^(?:' + include + ')'

    if include.length is 0
        return new RegExp '^(?!' + exclude + ')'

    return new RegExp '^(?!' + exclude + ')(?:' + include + ')'
