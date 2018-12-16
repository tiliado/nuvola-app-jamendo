/*
 * Copyright 2018 Jiří Janoušek <janousek.jiri@gmail.com>
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

'use strict';

(function (Nuvola) {
  var PlaybackState = Nuvola.PlaybackState
  var PlayerAction = Nuvola.PlayerAction
  var C_ = Nuvola.Translate.pgettext
  var player = Nuvola.$object(Nuvola.MediaPlayer)
  var ACTION_LOVE = 'love'

  var WebApp = Nuvola.$WebApp()

  WebApp._onInitAppRunner = function (emitter) {
    Nuvola.WebApp._onInitAppRunner.call(this, emitter)
    Nuvola.actions.addAction('playback', 'win', ACTION_LOVE, C_('Action', 'Love track'),
      null, null, null, false)
  }

  WebApp._onInitWebWorker = function (emitter) {
    Nuvola.WebApp._onInitWebWorker.call(this, emitter)

    var state = document.readyState
    if (state === 'interactive' || state === 'complete') {
      this._onPageReady()
    } else {
      document.addEventListener('DOMContentLoaded', this._onPageReady.bind(this))
    }
  }

  WebApp._onPageReady = function () {
    Nuvola.actions.connect('ActionActivated', this)
    player.addExtraActions([ACTION_LOVE])

    this.update()
  }

  WebApp.update = function () {
    var elms = this._getElements()
    var track = {
      title: Nuvola.queryText('.player-mini_track_information_title.js-player-name'),
      artist: Nuvola.queryText('.player-mini_track_information_artist.js-player-artistId'),
      album: null,
      artLocation: Nuvola.queryAttribute('.js-full-player-cover-img', 'src', (src) => src ? src : null),
      rating: null,
      length: elms.timeTotal
    }

    var state
    if (elms.pause) {
      state = PlaybackState.PLAYING
    } else if (elms.play) {
      state = PlaybackState.PAUSED
    } else {
      state = PlaybackState.UNKNOWN
    }

    player.setPlaybackState(state)
    player.setTrack(track)
    player.setTrackPosition(Nuvola.queryText('.js-player-position'))
    player.updateVolume(this._getVolume())
    player.setCanGoPrev(!!elms.prev)
    player.setCanGoNext(!!elms.next)
    player.setCanPlay(!!elms.play)
    player.setCanPause(!!elms.pause)
    player.setCanSeek(state !== PlaybackState.UNKNOWN && elms.progressbar)
    player.setCanChangeVolume(!!elms.volumebar)

    var repeat = this._getRepeat(elms)
    player.setCanRepeat(repeat !== null)
    player.setRepeatState(repeat)

    var shuffle = this._getShuffle(elms)
    player.setCanShuffle(shuffle !== null)
    player.setShuffleState(shuffle)

    Nuvola.actions.updateEnabledFlag(ACTION_LOVE, !!elms.love)
    Nuvola.actions.updateState(ACTION_LOVE, elms.love && elms.love.classList.contains('is-on') ? true : false)

    setTimeout(this.update.bind(this), 500)
  }

  WebApp._onActionActivated = function (emitter, name, param) {
    var elms = this._getElements()
    switch (name) {
      case PlayerAction.TOGGLE_PLAY:
        if (elms.play) {
          Nuvola.clickOnElement(elms.play)
        } else {
          Nuvola.clickOnElement(elms.pause)
        }
        break
      case PlayerAction.PLAY:
        Nuvola.clickOnElement(elms.play)
        break
      case PlayerAction.PAUSE:
      case PlayerAction.STOP:
        Nuvola.clickOnElement(elms.pause)
        break
      case PlayerAction.PREV_SONG:
        Nuvola.clickOnElement(elms.prev)
        break
      case PlayerAction.NEXT_SONG:
        Nuvola.clickOnElement(elms.next)
        break
      case PlayerAction.REPEAT:
        this._setRepeat(elms, param)
        break
      case PlayerAction.SHUFFLE:
        Nuvola.clickOnElement(elms.shuffle)
        break
      case PlayerAction.SEEK:
        var total = Nuvola.parseTimeUsec(elms.timeTotal)
        if (param > 0 && param <= total) {
          Nuvola.setInputValueWithEvent(elms.progressbar, 100 * param / total)
        }
        break
      case PlayerAction.CHANGE_VOLUME:
        Nuvola.setInputValueWithEvent(elms.volumebar, Math.round(100 * param))
        break
      case ACTION_LOVE:
        Nuvola.clickOnElement(elms.love)
        break
    }
  }

  WebApp._getElements = function () {
    var elms = {
      miniPlayer: document.querySelector('.player-mini_controls.player-controls.js-player-control'),
      play: document.querySelector('button.player-controls_play.js-player-play-pause'),
      pause: null,
      next: document.querySelector('button.player-controls_next.js-player-next'),
      prev: document.querySelector('button.player-controls_previous.js-player-previous'),
      repeat: document.querySelector('button.player-controls_repeat.js-player-repeat'),
      shuffle: document.querySelector('button.player-controls_shuffle.js-player-shuffle'),
      timeTotal: Nuvola.queryText('.js-player-duration'),
      progressbar: document.querySelector('.js-player-progress-slider'),
      volumebar: document.querySelector('.js-player-volume-slider'),
      love: document.querySelector('button > i.icon.icon-heart')
    }
    if (elms.love) {
      elms.love = elms.love.parentNode
    }

    // Ignore disabled buttons
    for (var key in elms) {
      if (elms[key] && elms[key].disabled) {
        elms[key] = null
      }
    }

    // Distinguish between play and pause action
    if (elms.play && elms.miniPlayer && !elms.miniPlayer.classList.contains('is-pause')) {
      elms.pause = elms.play
      elms.play = null
    }
    return elms
  }

  WebApp._getRepeat = function (elms) {
    if (!elms.repeat || !elms.miniPlayer) {
      return null
    }
    var classes = elms.miniPlayer.classList
    if (classes.contains('is-repeat-one')) {
      return Nuvola.PlayerRepeat.TRACK
    }
    return classes.contains('is-repeat') ? Nuvola.PlayerRepeat.PLAYLIST : Nuvola.PlayerRepeat.NONE
  }

  WebApp._setRepeat = function (elms, repeat) {
    while (this._getRepeat(elms) !== repeat) {
      Nuvola.clickOnElement(elms.repeat)
    }
  }

  WebApp._getShuffle = function (elms) {
    if (!elms.shuffle || !elms.miniPlayer) {
      return null
    }
    return elms.miniPlayer.classList.contains('is-shuffle')
  }

  WebApp._getVolume = function () {
    var elm = document.querySelector('.player-volume_range_fill.js-player-volume-bar')
    var volume = null
    if (elm) {
      var width = elm.style.width
      if (width.endsWith('%')) {
        volume = width.slice(0, -1) / 100
      }
    }
    return volume === null ? 1 : volume
  }

  WebApp.start()
})(this) // function(Nuvola)
