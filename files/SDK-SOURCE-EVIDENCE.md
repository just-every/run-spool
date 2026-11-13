# sentry-ruby 7.1.0 loss-report source
Source: https://rubygems.org/downloads/sentry-ruby-7.1.0.gem
Gem SHA256: bd6d2d022d879268526f62f0dccfb76aac99542bfce355e2b6a49cd1a81c0102

Read-only package inspection. These paths explain the SDK report labels; they do not identify which exception happened in the original CI process.

## lib/sentry/client.rb
```text
295: 
296:       transport.send_event(event) if configuration.sending_to_dsn_allowed?
297:       spotlight_transport.send_event(event) if spotlight_transport
298: 
299:       event
300:     rescue => e
301:       log_error("Event sending failed", e, debug: configuration.debug)
302:       transport.record_lost_event(:network_error, data_category)
303:       transport.record_lost_event(:network_error, "span", num: spans_before + 1) if event.is_a?(TransactionEvent)
304:       raise
305:     end
306: 
307:     # Send an envelope directly to Sentry.
308:     # @param envelope [Envelope] the envelope to be sent.
309:     # @return [void]
310:     def send_envelope(envelope)
311:       transport.send_envelope(envelope) if configuration.sending_to_dsn_allowed?
312:       spotlight_transport.send_envelope(envelope) if spotlight_transport
313:     rescue => e
314:       log_error("Envelope sending failed", e, debug: configuration.debug)
315: 
316:       envelope.items.each do |item|
317:         transport.record_lost_event(
318:           :network_error,
319:           item.data_category,
320:           num: item.item_count,
321:           num_bytes: item.lost_event_byte_size
322:         )
323:       end
324: 
325:       raise
326:     end
```

## lib/sentry/transport.rb
```text
170:     def record_lost_event(reason, data_category, num: 1, num_bytes: nil)
171:       return unless @send_client_reports
172:       return unless CLIENT_REPORT_REASONS.include?(reason)
173: 
174:       @discarded_events[[reason, data_category]] += num
175: 
176:       return unless num_bytes
177: 
178:       byte_category = Envelope::Item.byte_data_category(data_category)
179:       @discarded_events[[reason, byte_category]] += num_bytes if byte_category
180:     end
181: 
182:     def flush
183:       client_report_headers, client_report_payload = fetch_pending_client_report(force: true)
184:       return unless client_report_headers
185: 
186:       envelope = Envelope.new
187:       envelope.add_item(client_report_headers, client_report_payload)
188:       send_envelope(envelope)
189:     end
190: 
191:     private
192: 
193:     def fetch_pending_client_report(force: false)
194:       return nil unless @send_client_reports
195:       return nil if !force && @last_client_report_sent > Time.now - CLIENT_REPORT_INTERVAL
196:       return nil if @discarded_events.empty?
197: 
198:       discarded_events_hash = @discarded_events.map do |key, val|
199:         reason, category = key
200:         { reason: reason, category: category, quantity: val }
201:       end
202: 
203:       item_header = { type: "client_report" }
204:       item_payload = {
205:         timestamp: Sentry.utc_now.iso8601,
206:         discarded_events: discarded_events_hash
207:       }
208: 
209:       @discarded_events = Hash.new(0)
210:       @last_client_report_sent = Time.now
211: 
212:       [item_header, item_payload]
213:     end
214: 
215:     def reject_rate_limited_items(envelope)
216:       envelope.items.reject! do |item|
```

## lib/sentry/transport/http_transport.rb
```text
31:     def send_data(data)
32:       encoding = ""
33: 
34:       if should_compress?(data)
35:         data = Zlib.gzip(data)
36:         encoding = GZIP_ENCODING
37:       end
38: 
39:       headers = {
40:         "Content-Type" => CONTENT_TYPE,
41:         "Content-Encoding" => encoding,
42:         "User-Agent" => USER_AGENT
43:       }
44: 
45:       auth_header = generate_auth_header
46:       headers["X-Sentry-Auth"] = auth_header if auth_header
47: 
48:       response = do_request(endpoint, headers, data)
49: 
50:       if response.code.match?(/\A2\d{2}/)
51:         handle_rate_limited_response(response) if has_rate_limited_header?(response)
52:       elsif response.code == "413"
53:         error_message = "HTTP 413: Envelope dropped due to exceeded size limit"
54:         error_message += " (body: #{response.body})" if response.body && !response.body.empty?
55:         log_warn(error_message)
56: 
57:         raise Sentry::SizeExceededError, error_message
58:       elsif response.code == "429"
59:         log_debug("the server responded with status 429")
60:         handle_rate_limited_response(response)
61:       else
62:         error_info = "the server responded with status #{response.code}"
63:         error_info += "\nbody: #{response.body}"
64:         error_info += " Error in headers is: #{response['x-sentry-error']}" if response["x-sentry-error"]
65: 
66:         raise Sentry::ExternalError, error_info
67:       end
68:     rescue SocketError, *HTTP_ERRORS => e
69:       on_error if respond_to?(:on_error)
70:       raise Sentry::ExternalError.new(e&.message)
71:     end
72: 
```
